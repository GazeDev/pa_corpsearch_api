module.exports = (models) => {
  const Boom = require('@hapi/boom');
  // const used = process.memoryUsage().heapUsed / 1024 / 1024;
  // console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  const Sequelize = require('sequelize');
  const Op = Sequelize.Op;
  const CDP = require('chrome-remote-interface');
  const cdpOptions = {
    host: 'chrome'
  };

  const EventEmitter = require('events');

  class SearchEmitter extends EventEmitter {}
  const searchEmitter = new SearchEmitter();

  return {
    doBrowserTest: async function(request, h) {
      try {
        console.log('request params', 'none');
        let results = await requestToGetHeaders();
        return {
          results: results,
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    getTabs: async function(request, h) {
      try {
        let list = await CDP.List(cdpOptions);

        return {
          results: list
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    clearTabs: async function(request, h) {
      try {
        let list = await CDP.List(cdpOptions);
        for (let item of list) {
          // console.log(item.id);
          let closeOptions = cdpOptions;
          closeOptions.id = item.id;
          await CDP.Close(closeOptions);
        }
        let results = await CDP.List(cdpOptions);
        return {
          results: results,
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    clearTab: async function(request, h) {
      let list = await CDP.List(cdpOptions);
      let tabId = request.params.tabId;
      let tabFound = false;
      for (let item of list) {
        if(item.id == tabId) {
          tabFound = true;
        };
      }
      if (!tabFound) {
        return {
          'result': `No Tab found with ID: ${tabId}`,
        }
      }
      try {
        let closeOptions = cdpOptions;
        closeOptions.id = tabId;
        await CDP.Close(closeOptions);
        return {
          'result': `Closing Tab with ID: ${tabId}`,
        }
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
  };

  async function requestToGetHeaders() {
    let target = {};
    try {
      target = await CDP.New(cdpOptions);
      let client = await CDP({target: target});
      const {Page, Runtime} = client;
      await Page.enable();
      await Page.navigate({url: 'http://xhaus.com/headers'});
      await Page.loadEventFired();
      let results = {};
      try {
        // TODO: test this to see if we get the results we're expecting. may need to JSON.parse resultsData.
          let getResultsData = [
            `
            let results = {};
            let browserTableRows = document.querySelectorAll('table tbody tr');
            let head = 'default';
            for (let row of browserTableRows) {
              if (row.querySelectorAll('th').length > 0) { // head row
                head = row.querySelectorAll('th')[0].innerText;
                results[head] = {};
              } else { // data row
                let data = row.querySelectorAll('td');
                results[head][data[0].innerText] = data[1].innerText;
              }
            }

            return JSON.stringify(results);
            `
          ];
          let resultsData = await executeCommands(Page, Runtime, getResultsData);
          console.log('resultsdata', resultsData);
          results = resultsData;
      } catch (e) {
        console.log('catch', e);
        throw 'Error during command execution';
      }
      await CDP.Close({ ...cdpOptions, ...{id: target.id}});
      // console.log('results data', resultsData);
      return results;
    } catch (err) {
      console.error(err);
      if (target.hasOwnProperty('id')) {
        try {
          await CDP.Close({ ...cdpOptions, ...{id: target.id}});
        } catch (e) {
          console.log('error closing in finally', e);
        }
      }
      throw Boom.badImplementation('Error during live corpsearch request');
    }
  }

  async function executeCommands(Page, Runtime, commands) {
    let result;
    let count = 0;
    try {
      for (let command of commands) {
        if (command == 'wait') {
          await Page.loadEventFired();
          let pageTitle = await executeCommands(Page, Runtime,
            ['return JSON.stringify(document.title);']
          );
          if (pageTitle == "Runtime Error") {
            console.log("Runtime Error, Command Wait", commands);
          }
        } else {
          // we encapsulate commands so the console doesn't error on looped uses of let and const
          result = await Runtime.evaluate({expression: `(()=>{
            ${command}
          })();`});
        }
        count ++;
      }
      // console.log(typeof result, result);
      if (result.result.type == 'undefined') {
        return null;
      }
      return JSON.parse(result.result.value);
    } catch (e) {
      console.log('error executing command', e);
      return null;
    }
  }

};
