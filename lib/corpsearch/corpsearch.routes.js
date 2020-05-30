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
    ];
  },
};
