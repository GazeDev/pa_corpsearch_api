
module.exports = {
  routes: () => {
    const controllers = require('./corpsearch.controllers.js')();
    const corpsearchModels = require('./corpsearch.models');
    return [
      {
        method: 'GET',
        path: '/corpsearch',
        handler: controllers.getCorps,
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
    ];
  },
};
