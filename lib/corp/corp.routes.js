module.exports = {
  routes: (models) => {
    const helpers = require('../helpers');
    const controllers = require('./corp.controllers.js')(models);
    const corpModels = require('./corp.models');
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
            query: corpModels.apiFilterQuery,
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
            query: corpModels.apiEnumeration,
          }
        }
      },
      {
        method: 'PATCH',
        path: '/searches/{searchId}/action',
        handler: controllers.actionOnCorpsEnumeration,
        config: {
          auth: 'jwt',
          pre: [
            { method: helpers.ensureAdmin },
            { method: controllers.lib.ensureSearch, assign: 'search', failAction: 'error' },
          ],
          description: 'Action Enumeration of Corporations',
          notes: 'Perform and Action on the Enumeration of Corporations',
          tags: ['api', 'Searches'],
          validate: {
            params: searchModels.searchId,
            payload: searchModels.searchActions,
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
        path: '/corps/search',
        handler: controllers.getCorpsSearch,
        config: {
          auth: 'jwt',
          description: 'Get Corps via Search',
          notes: 'Get corporate entities from db. Submitting name and address acts as an OR statement',
          tags: ['api', 'Corps Search'],
          validate: {
            query: corpModels.apiCorpsQuery,
          }
        }
      },
      {
        method: 'PATCH',
        path: '/corps/search/process',
        handler: controllers.processCorpsSearchables,
        config: {
          auth: 'jwt',
          pre: [
            { method: helpers.ensureAdmin }
          ],
          description: 'Process Corporation Searchables',
          notes: 'Process the Names and Addresses in a Corp for searching',
          tags: ['api', 'Corps Search'],
          validate: {
            payload: corpModels.apiProcessSearchables,
          }
        }
      },
    ];
  },
};
