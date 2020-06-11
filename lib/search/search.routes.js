module.exports = {
  routes: (models) => {
    const controllers = require('./search.controllers.js')(models);
    const searchModels = require('./search.models');
    return [

    ];
  },
};
