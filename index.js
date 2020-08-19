'use strict';

const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');

const jwt = require('hapi-auth-jwt2');
const jwksRsa = require('jwks-rsa');
const Boom = require('@hapi/boom');
const {Sequelize, DataTypes} = require('sequelize');
const HAPIWebSocket = require("hapi-plugin-websocket");

module.exports = (async() => {

  await ensureEnvironmentVariables();

  const server = await newHapiServer();

  const sequelize = await newSequelize();

  const modules = require('./lib/modules');

  // sequelize modified by reference, returns models for injecting elsewhere
  const models = await defineAndAssociateModels(sequelize, modules);

  /*
    NOTE:
    If a user has Authorization token, it will be passed and validated. If it is
    invalid the request will fail. Any handler can check if the user is authenticated
    by checking `request.auth.isAuthenticated`. Any route can require authentication
    by setting `config.auth: 'jwt'`, which will require the 'jwt' auth strategy
    from above. If a user is authenticated then the credentials from the strategy
    will be available in `request.auth.credentials`.
   */
  await serverRegisterAuthStrategy(server);

  // server modified by reference to register routes, nothing returned
  await registerModulesRoutes(server, models, modules);

  // Register HAPIWebSocket so routes can use wss://
  await server.register(HAPIWebSocket);

  await registerSwaggerDocs(server);

  try {
    server.start();
    console.info('server running at ' + process.env.SELF_HOST);
  } catch(err) {
    console.error(err);
  }

  return {
    server: server,
  };
})();

function ensureEnvironmentVariables() {
  const envVars = [
    // require SUPER_ADMIN to be set, otherwise it's possible a request without auth could pass SUPER_ADMIN status
    // (subjectId on auth credentials would match SUPER_ADMIN: undefined)
    'SUPER_ADMIN',
    'CORS_ORIGIN',
    'SELF_HOST',
    'JWT_AUDIENCE',
    'JWT_ISSUER',
    'JWT_NETWORK_URI',
    'JWT_CLIENT',
    'JWT_CLIENT_ROLE',
    'DATABASE_URL',
  ];

  for (let envVar of envVars) {
    if (!process.env[envVar]) {
      console.error(`Error: Make sure you have ${envVar} in your environment variables.`);
    }
  }
}

function newHapiServer() {
  const server = new Hapi.Server({
    port: process.env.PORT || 8081,
    routes: {cors: {
      additionalHeaders: ['access-control-allow-origin'],
      exposedHeaders: ['Content-Location'],
      origin: [process.env.CORS_ORIGIN],
    }}
  });
  return server;
}

function newSequelize() {
  let sequelize;
  try {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      pool: {
        log: true,
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      logging: false,
    });
  } catch (err) {
    console.error('Sequelize init error:');
    console.error(err);
  }
  return sequelize;
}

async function defineAndAssociateModels(sequelize, modules) {
  let models = {}
  // define the models of all of our modules
  for (let mod of modules) {
    let modelsFile;
    try {
      modelsFile = require(`./lib/${mod}/${mod}.models.js`);
      if (modelsFile.db) {
        let model = modelsFile.db(sequelize, DataTypes);
        models[model.name] = model;
      }
    } catch(err) {
      console.log(err);
      console.log(`module ${mod} did not have a models file`);
    }
  }
  // now that all the models are loaded, run associations
  Object.keys(models).forEach(function(modelName) {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });
  models.sequelize = sequelize;

  try {
    if (process.env['DB_DESTROY_DATABASE_RESTRUCTURE'] === 'DB_DESTROY_DATABASE_RESTRUCTURE') {
      // NOTE: This will wipe/forcibly restructure a database. ONLY USE FOR DEV.
      await sequelize.sync({force: true});
    } else {
      await sequelize.sync();
    }
  } catch (e) {
    console.log('Error during sync:', e);
  }

  return models;
}

async function serverRegisterAuthStrategy(server) {
  const validateUser = async (decoded, request) => {
    // This is a simple check that the `sub` claim
    // exists in the access token.

    if (decoded && decoded.sub) {
      if (!validateTokenClientRole(decoded)) {
        throw Boom.forbidden(`Must have the ${process.env.JWT_CLIENT_ROLE} role to access this resource`);
        return {isValid: false};
      }
      // Email may not be verified, we should decide if that's OK and/or if we
      // validate that at this level or the route level.
      return {
        isValid: true,
        credentials: {
          scope: decoded.scope.split(' '),
          resourceAccess: decoded.resource_access,
          subjectId: decoded.sub,
          email: decoded.email,
          emailVerified: decoded.email_verified,
          name: decoded.name,
          preferredUsername: decoded.preferred_username,
          givenName: decoded.given_name,
          familyName: decoded.family_name,
        },
      };
    }
    return { isValid: false };
  };

  await server.register(jwt);

  server.auth.strategy('jwt', 'jwt', {
    complete: true,
    // verify the access token against the remote JWKS
    key: jwksRsa.hapiJwt2KeyAsync({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 60,
      jwksUri: `${process.env.JWT_NETWORK_URI}/protocol/openid-connect/certs`,
    }),
    verifyOptions: {
      audience: process.env.JWT_AUDIENCE,
      issuer: process.env.JWT_ISSUER,
      algorithms: ['RS256']
    },
    validate: validateUser
  });

  server.auth.strategy('wsjwt', 'jwt', {
    complete: true,
    // we only want to extract token from payload for websocket requests. Using
    // attemptToExtractTokenInPayload on POST requests without a body allows the
    // request to go through as authd when it's not (because it expects a payload
    // validation that never happens)
    // attempt to get token from 'token' param in payload.
    // THE ROUTE'S auth.payload *MUST* BE SET TO true, OTHERWISE THE SECOND PASS
    // CHECK WON'T BE DONE AND AUTH CAN BE BYPASSED
    attemptToExtractTokenInPayload: 'true',
    payloadKey: 'Authorization',
    // verify the access token against the remote JWKS
    key: jwksRsa.hapiJwt2KeyAsync({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 60,
      jwksUri: `${process.env.JWT_NETWORK_URI}/protocol/openid-connect/certs`,
    }),
    verifyOptions: {
      audience: process.env.JWT_AUDIENCE,
      issuer: process.env.JWT_ISSUER,
      algorithms: ['RS256']
    },
    validate: validateUser
  });

  server.auth.default({
    strategy: 'jwt',
    mode: 'optional'
  });
}

  function validateTokenClientRole(token) {
    let result = false;
    if (
      token.hasOwnProperty('resource_access') &&
      token.resource_access.hasOwnProperty(process.env.JWT_CLIENT) &&
      token.resource_access[process.env.JWT_CLIENT].hasOwnProperty('roles') &&
      Array.isArray(token.resource_access[process.env.JWT_CLIENT].roles) &&
      token.resource_access[process.env.JWT_CLIENT].roles.includes(process.env.JWT_CLIENT_ROLE)
    ) {
      result = true;
    }
    return result;
  }

async function registerModulesRoutes(server, models, modules) {
  // Build the routes of all our modules, injecting the models into each
  for (let mod of modules) {
    let routesFile;
    try {
      routesFile = require(`./lib/${mod}/${mod}.routes.js`);
      if(routesFile.routes) {
        await server.route(routesFile.routes(models));
      }
    } catch(err) {
      console.error(err);
      console.error(`module ${mod} did not have a routes file or hapi failed to register them`);
    }
  }

  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, h) {
      return h
        .response({status: 'up'});
    }
  });
}

async function registerSwaggerDocs(server) {
  const swaggerOptions = {
    host: process.env.SELF_HOST,
    info: {
      title: 'API Documentation',
      version: "1.0",
    },
    grouping: 'tags',
    securityDefinitions: {
      'Bearer': {
        'type': 'apiKey',
        'name': 'Authorization',
        'in': 'header'
      },
      // NOTE: type: openIdConnect is not yet supported in the ui: https://github.com/swagger-api/swagger-ui/issues/3517
      //   Furthermore, at last check (2020-05-25) hapi-swagger-ui is using swagger ui v2, not v3
      // 'gaze_auth': {
      //   'type': 'openIdConnect',
      //   'openIdConnectUrl': `${process.env.JWT_ISSUER}/.well-known/openid-configuration`,
      // },
    },
    security: [{
      'Bearer': [],
      // 'gaze_auth': [],
    }],
    // jsonEditor: true,
  };

  try {
    await server.register([Inert, Vision, {
      'plugin': HapiSwagger,
      'options': swaggerOptions
    }]);
  } catch (err) {
    console.error(err);
  }
}
