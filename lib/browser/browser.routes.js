module.exports = {
  routes: (models) => {
    const controllers = require('./browser.controllers.js')(models);
    const browserModels = require('./browser.models');
    return [
      {
        method: 'GET',
        path: '/browser/test',
        handler: controllers.doBrowserTest,
        config: {
          auth: 'jwt',
          description: 'Browser Test',
          notes: 'Makes a request to a page that will return info about the browser',
          tags: ['api', 'Browser'],
        }
      },
      {
        method: 'GET',
        path: '/browser/tabs',
        handler: controllers.getTabs,
        config: {
          auth: 'jwt',
          description: 'Get Tabs',
          notes: 'Get tabs from chrome',
          tags: ['api', 'Browser'],
        }
      },
      {
        method: 'DELETE',
        path: '/browser/tabs',
        handler: controllers.clearTabs,
        config: {
          auth: 'jwt',
          description: 'Delete Tabs',
          notes: 'Delete all tabs from chrome',
          tags: ['api', 'Browser'],
        }
      },
      {
        method: 'DELETE',
        path: '/browser/tabs/{tabId}',
        handler: controllers.clearTab,
        config: {
          auth: 'jwt',
          description: 'Delete Individual Tab',
          notes: 'Delete a single tab from chrome',
          tags: ['api', 'Browser'],
          validate: {
            params: browserModels.apiTabsId,
          }
        }
      },
    ];
  },
};
