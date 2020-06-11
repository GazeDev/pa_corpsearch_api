module.exports = {
  routes: (models) => {
    const controllers = require('./corpsearch.controllers.js')(models);
    const corpsearchModels = require('./corpsearch.models');
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
        method: 'POST',
        path: '/getSearchEvents',
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
    ];
  },
};
