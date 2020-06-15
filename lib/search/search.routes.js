module.exports = {
  routes: (models) => {
    const controllers = require('./search.controllers.js')(models);
    const searchModels = require('./search.models');
    return [
      {
        method: 'GET',
        path: '/searches',
        handler: controllers.getSearches,
        config: {
          auth: 'jwt',
          description: 'Get Searches',
          notes: 'View Searches stored in the Database',
          tags: ['api', 'Searches'],
        }
      },
    ];
  },
};
