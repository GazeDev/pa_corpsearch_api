'use strict';

const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');

// const jwt = require('hapi-auth-jwt2');
// const jwksRsa = require('jwks-rsa');


module.exports = (async() => {

  const envVars = [
    'CORS_ORIGIN',
    'SELF_HOST',
  ];

  for (let envVar of envVars) {
    if (!process.env[envVar]) {
      console.error(`Error: Make sure you have ${envVar} in your environment variables.`);
    }
  }

  const server = new Hapi.Server({
    port: process.env.PORT || 8081,
    routes: {cors: {
      additionalHeaders: ['access-control-allow-origin'],
      exposedHeaders: ['Content-Location'],
      origin: [process.env.CORS_ORIGIN],
    }}
  });

  const modules = require('./lib/modules');

  const routes = [];

  // const validateUser = async (decoded, request) => {
  //   // This is a simple check that the `sub` claim
  //   // exists in the access token.
  //
  //   if (decoded && decoded.sub) {
  //     // Email may not be verified, we should decide if that's OK and/or if we
  //     // validate that at this level or the route level.
  //     return {
  //       isValid: true,
  //       credentials: {
  //         scope: decoded.scope.split(' '),
  //         resourceAccess: decoded.resource_access,
  //         subjectId: decoded.sub,
  //         email: decoded.email,
  //         emailVerified: decoded.email_verified,
  //         name: decoded.name,
  //         preferredUsername: decoded.preferred_username,
  //         givenName: decoded.given_name,
  //         familyName: decoded.family_name,
  //       },
  //     };
  //   }
  //   return { isValid: false };
  // };

  // await server.register(jwt);

  // server.auth.strategy('jwt', 'jwt', {
  //   complete: true,
  //   // verify the access token against the remote JWKS
  //   key: jwksRsa.hapiJwt2KeyAsync({
  //     cache: true,
  //     rateLimit: true,
  //     jwksRequestsPerMinute: 60,
  //     jwksUri: `${process.env.JWT_NETWORK_URI}/protocol/openid-connect/certs`,
  //   }),
  //   verifyOptions: {
  //     audience: process.env.JWT_AUDIENCE,
  //     issuer: process.env.JWT_ISSUER,
  //     algorithms: ['RS256']
  //   },
  //   validate: validateUser
  // });

  // server.auth.default({
  //   strategy: 'jwt',
  //   mode: 'optional'
  // });

  /*
    NOTE:
    If a user has Authorization token, it will be passed and validated. If it is
    invalid the request will fail. Any handler can check if the user is authenticated
    by checking `request.auth.isAuthenticated`. Any route can require authentication
    by setting `config.auth: 'jwt'`, which will require the 'jwt' auth strategy
    from above. If a user is authenticated then the credentials from the strategy
    will be available in `request.auth.credentials`.
   */

  // Build the routes of all our modules, injecting the models into each
  for (let mod of modules) {
    let routesFile;
    try {
      routesFile = require(`./lib/${mod}/${mod}.routes.js`);
      if(routesFile.routes) {
        await server.route(routesFile.routes());
      }
    } catch(err) {
      console.log(err);
      console.log(`module ${mod} did not have a routes file or hapi failed to register them`);
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

  const swaggerOptions = {
    host: process.env.SELF_HOST,
    info: {
      title: 'API Documentation',
      version: "1.0",
    },
    grouping: 'tags',
    // securityDefinitions: {
    //   'Bearer': {
    //     'type': 'apiKey',
    //     'name': 'Authorization',
    //     'in': 'header'
    //   },
    //   // 'gaze_auth': {
    //   //   'type':	'oauth2',
    //   //   'authorizationUrl':	`${process.env.JWT_ISSUER}/protocol/openid-connect/auth`,
    //   //   'tokenUrl': `${process.env.JWT_ISSUER}/protocol/openid-connect/token`,
    //   //   'flow':	'accessCode'
    //   // },
    // },
    // security: [{ 'Bearer': []}],
    // jsonEditor: true,
  };

  try {
    await server.register([Inert, Vision, {
      'plugin': HapiSwagger,
      'options': swaggerOptions
    }]);
  } catch (err) {
    console.log(err);
  }


  try {
    server.start();
  } catch(err) {
    console.log(err);
  }

  return {
    server: server,
  };
})();
