const { expect } = require('@hapi/code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const Joi = require('@hapi/joi');

lab.experiment('Account', () => {
  let server;
  let accountId = '';
  let accessToken = '';
  let adminAccessToken = '';

  lab.before(async() => {
    const index = await require('../../index.js');
    server = await index.server;
    await index.sequelize;
  });

  lab.test('JOI Token Validation', async () => {
    // wait for the response and the request to finish
    let token = {
      "resource_access": {
        "ownersearch": {
          "roles": [
            "api-access"
          ]
        },
        "account": {
          "roles": [
            "manage-account",
            "manage-account-links",
            "view-profile"
          ]
        }
      },
    };

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

    expect(result).to.be.true();

  });


});

function getAccessToken(username, password) {

  return new Promise((resolve, reject) => {
    var qs = require("querystring");
    var http = require("https");

    const endpoint = new URL(process.env.JWT_NETWORK_URI + '/protocol/openid-connect/token');

    const options = {
      "method": "POST",
      "headers": {
        "Content-Type": "application/x-www-form-urlencoded",
      }
    };

    var req = http.request(endpoint, options, function (res) {
      let chunks = "";

      res.on("data", function (chunk) {
        chunks += chunk;
      });

      res.on("end", function () {
        resolve(JSON.parse(chunks));
      });
    });

    req.write(
      qs.stringify({
        grant_type: 'password',
        client_id: process.env.JWT_CLIENT,
        username: username,
        password: password,
      })
    );
    req.end();

  });
}
