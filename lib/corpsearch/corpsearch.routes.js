module.exports = {
  routes: (models) => {
    const helpers = require('../helpers');
    const controllers = require('./corpsearch.controllers.js')(models);
    const corpsearchModels = require('./corpsearch.models');
    const searchModels = require('../search/search.models');
    return [
      {
        method: 'GET',
        path: '/corpsearch/live',
        handler: controllers.getCorpsLive,
        config: {
          auth: 'jwt',
          description: 'Search Corporate Entities',
          notes: 'Search and scrape corporate entities from PA Corp Website',
          tags: ['api', 'Corps Search'],
          validate: {
            query: corpsearchModels.apiFilterQuery,
          }
        }
      },
      {
        method: 'POST',
        path: '/corpsearch/enumeration',
        handler: controllers.postCorpsEnumeration,
        options: {
          auth: 'jwt',
          pre: [
            { method: helpers.ensureAdmin }
          ],
          description: 'Enumerate Corporate Entities',
          notes: 'Enumerate through corporate entities from PA Corp Website',
          tags: ['api', 'Corps Search'],
          validate: {
            query: corpsearchModels.apiEnumeration,
          }
        }
      },
      {
        method: 'PATCH',
        path: '/searches/{searchId}/resume',
        handler: controllers.resumeCorpsEnumeration,
        config: {
          auth: 'jwt',
          pre: [
            { method: helpers.ensureAdmin }
          ],
          description: 'Resume Enumeration of Corporations',
          notes: 'Resume Enumeration of Corporations from where they were last left off',
          tags: ['api', 'Searches'],
          validate: {
            params: searchModels.searchId,
          }
        }
      },
      {
        method: 'POST',
        path: '/ws/getSearchEvents',
        handler: controllers.getSearchEvents,
        config: {
          auth: {
            strategy: "wsjwt",
            payload: true,
          },
          payload: { output: "data", parse: true, allow: "application/json" },
          plugins: { websocket: true },
          description: 'Get Multiple',
          notes: 'Get multiple responses from hapi',
          tags: ['api', 'WebSockets'],
        },
      },
      {
        method: 'GET',
        path: '/corps',
        handler: controllers.getCorps,
        config: {
          auth: 'jwt',
          pre: [
            // Limit to super_admin until we add limit protections to prevent
            // process crashing from too many db results
            { method: helpers.ensureAdmin }
          ],
          description: 'Get Corporate Entities',
          notes: 'Get corporate entities from db',
          tags: ['api', 'Corps Search'],
          validate: {
            query: corpsearchModels.apiCorpsFilter,
          }
        }
      },
    ];
  },
};
