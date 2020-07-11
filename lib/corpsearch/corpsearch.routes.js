module.exports = {
  routes: (models) => {
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
        config: {
          auth: 'jwt',
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
            strategy: "jwt",
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
          description: 'Get Corporate Entities',
          notes: 'Get corporate entities from db',
          tags: ['api', 'Corps Search'],
          validate: {
            query: corpsearchModels.apiCorpsFilter,
          }
        }
      },
      {
        method: 'GET',
        path: '/tabs',
        handler: controllers.getTabs,
        config: {
          auth: 'jwt',
          description: 'Get Tabs',
          notes: 'Get tabs from chrome',
          tags: ['api', 'Tabs'],
        }
      },
      {
        method: 'DELETE',
        path: '/tabs',
        handler: controllers.clearTabs,
        config: {
          auth: 'jwt',
          description: 'Delete Tabs',
          notes: 'Delete all tabs from chrome',
          tags: ['api', 'Tabs'],
        }
      },
      {
        method: 'DELETE',
        path: '/tabs/{tabId}',
        handler: controllers.clearTab,
        config: {
          auth: 'jwt',
          description: 'Delete Individual Tab',
          notes: 'Delete a single tab from chrome',
          tags: ['api', 'Tabs'],
          validate: {
            params: corpsearchModels.apiTabsId,
          }
        }
      },
    ];
  },
};
