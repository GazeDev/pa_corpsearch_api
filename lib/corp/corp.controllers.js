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
    getCorpsLive: async function(request, h) {
      try {
        console.log('request params', request.query);
        let results = await requestToCorpSearchPortal(request.query);
        return {
          query: request.query,
          count: results.length,
          results: results,
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    postCorpsEnumeration: async function(request, h) {
      try {
        let start = request.query.start;
        let end = request.query.end;
        let queues = request.query.queues;
        let diff = end - start;
        let count = diff + 1; // because 'end' is inclusive
        let queueSize = Math.floor(count/queues);
        let maxQueueSize = Math.ceil(count/queues);
        let largerQueues = count % queues;

        let dbStart = start;
        let dbQueues = {};
        for (let qI = 0; qI < queues; qI ++) {
          let isMaxQueue = (largerQueues - qI > 0);
          let currentQSize = isMaxQueue ? maxQueueSize : queueSize;
          let dbEnd = dbStart + currentQSize -1;
          dbQueues[qI] = {
            status: 'in-progress',
            start: dbStart,
            end: dbEnd,
            id: dbStart,
          };
          dbStart = dbEnd + 1;
        }
        let search = await models.Search.create({
          query: {
            start: request.query.start,
            end: request.query.end,
            queues: request.query.queues,
          },
          queues: dbQueues,
        });

        // fill queues with sequential ids. fill as many queues to the max as possible
        // start queues async. each queue processes its items sync
        let enumStart = start;
        for (let qI = 0; qI < queues; qI ++) {
          let isMaxQueue = (largerQueues - qI > 0);
          let currentQSize = isMaxQueue ? maxQueueSize : queueSize;
          let enumEnd = enumStart + currentQSize -1;
          // we want to start all queues async, so don't await them. each queue
          // itself will run sync though
          processQSync({search: search, queue: qI, start: enumStart, end: enumEnd});

          enumStart = enumEnd + 1;
        }

        return {
          query: request.query,
          results: `Started query of entities ${request.query.start} - ${request.query.end} using ${queues} queue(s)`,
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    resumeCorpsEnumeration: async (request, h) => {
      let searchId = request.params.searchId;
      let search;
      try {
        search = await models.Search.findByPk(searchId);
        if (search === null) {
          throw "No result for that search ID";
        }
      } catch (e) {
        console.log('Error getting search', e);
      }

      for (let qI = 0; qI < search.query.queues; qI ++) {
        if (search.queues[qI].hasOwnProperty('targetId')) {
          try {
            let closeOptions = cdpOptions;
            closeOptions.id = search.queues[qI].targetId;
            console.log('resuming search. closing tab with id', closeOptions.id);
            await CDP.Close(closeOptions);
          } catch (e) {
            console.log('Error closing tab with id ', search.queues[qI].targetId, e);
          }
        }
        let enumStart = search.queues[qI].id;
        let enumEnd = search.queues[qI].end;
        processQSync({search: search, queue: qI, start: enumStart, end: enumEnd});
      }

      return {
        results: `Resumed search with id ${searchId}`,
      };
    },
    actionOnCorpsEnumeration: async (request, h) => {
      let searchId = request.params.searchId;
      let action = request.payload.action;
      let search = request.pre.search;

      if (action === 'stop' || action === 'resume') {
        for (let qI = 0; qI < search.query.queues; qI ++) {
          if (search.queues[qI].hasOwnProperty('targetId')) {
            try {
              let closeOptions = cdpOptions;
              closeOptions.id = search.queues[qI].targetId;
              await CDP.Close(closeOptions);
            } catch (e) {
              console.error('Error closing tab with id ', search.queues[qI].targetId, e);
            }
          }
          if (action === 'resume') {
            let enumStart = search.queues[qI].id;
            let enumEnd = search.queues[qI].end;
            processQSync({search: search, queue: qI, start: enumStart, end: enumEnd});
          }
        }
      }

      return {
        results: `Action (${action}) done for search with id ${searchId}`,
      };
    },
    getSearchEvents: (request, h) => {
      let { ws } = request.websocket();
      ws.send(JSON.stringify({ cmd: "HELLO", arg: "OPEN"}));
      searchEmitter.on('event', (params) => {
        ws.send(JSON.stringify(params));
      });
      return "";
    },
    getCorpsSearch: async function(request, h) {
      const { preProcessAddress, preProcessName } = require('./corp.helpers.js');
      let queryLimit = 8000;
      let idsBuilder = {};

      if (propOf(request.query, 'address')) {
        let address = request.query.address;
        let queryCorpIds = models.Address.findAll({
          attributes: ['CorpId'],
          where: {
            searchableAddressV1: {
              [Op.iLike]: '%'+ preProcessAddress(address, false) +'%',
            }
          },
          limit: queryLimit,
          order: [['CorpId', 'DESC']],
          raw: true,
        }).then((data) => {
          return data.map(item => item.CorpId);
        });
        idsBuilder.address = queryCorpIds;
      }

      if (propOf(request.query, 'name')) {
        let name = request.query.name;
        let queryCorpIds = models.Name.findAll({
          attributes: ['CorpId'],
          where: {
            searchableNameV1: {
              [Op.iLike]: '%'+ preProcessName(name, false) +'%',
            }
          },
          limit: 8000,
          order: [['CorpId', 'DESC']],
          raw: true,
        }).then((data) => {
          return data.map(item => item.CorpId);
        });
        idsBuilder.name = queryCorpIds;
      }

      // wait for both queries so they run parallel, not sequentially
      let queries = await Promise.all([idsBuilder.address, idsBuilder.name]);

      let notices = [];
      if (idsBuilder.hasOwnProperty('name')) {
        // should already be resolved, so negligble promise extraction
        let nameIds = await idsBuilder.name;
        if (nameIds.length === queryLimit) {
          notices.push({
            message: "Name query results truncated",
          });
        }
      }

      if (idsBuilder.hasOwnProperty('address')) {
        // should already be resolved, so negligble promise extraction
        let addressIds = await idsBuilder.address;
        if (addressIds.length === queryLimit) {
          notices.push({
            message: "Address query results truncated",
          });
        }
      }

      let corpIds = [];
      for (let queryIds of queries) {
        corpIds = corpIds.concat(queryIds);
      }

      let results;
      try {
        results = await models.Corp.findAll({
          where: {
            'id': {
              [Op.in]: corpIds,
            }
          },
          order: [['id', 'DESC']]
        });
      } catch (e) {
        console.error('Error', e);
      }

      return h.response({
        query: request.query,
        count: results.length,
        notices: notices,
        results: results,
      });

    },
    processCorpsSearchables: async function(request, h) {
      let start = request.payload.start;
      let end;
      if (request.payload.hasOwnProperty('end')) {
        end = request.payload.end;
      } else {
        end = start;
      }
      let limit = 100000;
      while (start <= end) {
        let tempEnd;
        if (start + limit -1 < end) {
          tempEnd = start + limit -1;
        } else {
          tempEnd = end;
        }
        await processAndUpdateSearchables(start, tempEnd);
        start = tempEnd +1;
      }

      return h.response({
        query: request.payload,
        count: end - request.payload.start +1,
      });
    },
    lib: {
      ensureSearch: ensureSearch,
    }
  };

  function propOf(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  async function requestToCorpSearchPortal(query) {
    let target = {};
    try {
      target = await CDP.New(cdpOptions);
      let client = await CDP({target: target});
      const {Page, Runtime} = client;
      await Page.enable();
      await Page.navigate({url: 'https://www.corporations.pa.gov/search/corpsearch'});
      await Page.loadEventFired();

      let resultsData = [];
      try {
        let getNumResults = [
          `
          document.getElementById('txtSearchTerms').value = "${query.name}";
          document.getElementById('btnSearch').click();
          `,
          'wait',
          `
          let change = new Event("change");
          document.getElementsByName('gvResults_length')[0].value = "-1";
          document.getElementsByName('gvResults_length')[0].dispatchEvent(change);
          `,
          `
          let corps = document.querySelectorAll('#gvResults tbody tr td a#lnkBEName');
          return JSON.stringify(corps.length);
          `,
        ];
        let numResults = await executeCommands(Page, Runtime, getNumResults);
        for (let i = 0; i < numResults; i++) {
          let getResultData = [
            `
            let change = new Event("change");
            document.getElementsByName('gvResults_length')[0].value = "-1";
            document.getElementsByName('gvResults_length')[0].dispatchEvent(change);
            `,
            `
            let corps = document.querySelectorAll('#gvResults tbody tr td a#lnkBEName');
            corps[${i}].click();
            `,
            'wait',
            `
            let name = document.querySelectorAll('#gvBusinessNameHistory tbody tr td')[0].innerText;
            let namesHistory = [];
            let namesTableRows = document.querySelectorAll('#gvBusinessNameHistory tbody tr');
            for (let row of namesTableRows) {
              if (row.children.length >= 2 && row.children[1].innerText !== "") {
                let obj = {};
                obj[row.children[1].innerText] = row.children[0].innerText;
                namesHistory.push(obj);
              }
            }

            let detailsParent = document.querySelectorAll('#namedetails')[0].parentNode;
            // console.log(detailsParent);

            let tableIndex;
            for (let index = 0; index < detailsParent.children.length; index++) {
              let childElement = detailsParent.children[index];
                // console.log(childElement);
                if (childElement.id == 'namedetails') {
                  tableIndex = index + 2;
                }
            }
            // console.log(tableIndex)
            let table = detailsParent.children[tableIndex];
            // console.log(table);
            let corpTable = table.children[0].children[0];
            // console.log('corpTable', corpTable);
            let corpRows = corpTable.children[0].children;
            let details = {};
            for (let row of corpRows) {
              if (row.children.length >= 2 && row.children[1].innerText !== "") {
                details[row.children[0].innerText] = row.children[1].innerText
              }
            }

            let hasOfficers = false;
            let officers = [];
            if (table.children[1].children.length) {
              hasOfficers = true;
              let officersTable = table.children[1].children[0];
              let officersRows = officersTable.children[0].children;
              // console.log('officersRows', officersRows);
              let officer = {};
              for (let row of officersRows) {
                if (row.children.length >= 2 && row.children[1].innerText !== "") {
                  officer[row.children[0].innerText] = row.children[1].innerText
                } else if (row.children.length < 2) {
                  officers.push(officer);
                  officer = {};
                }
              }
              officers.push(officer);
            }

            let result = {
              name: name,
              namesHistory: namesHistory,
              details: details,
            };
            if (hasOfficers) {
              result.officers = officers;
            }
            return JSON.stringify(result);
            `
          ];
          let resultData = await executeCommands(Page, Runtime, getResultData);
          resultsData.push(resultData);
          let backToSearch = [
            `document.getElementById('btnBackToSearchFromOrderBottom').click();`,
            'wait',
          ];
          await executeCommands(Page, Runtime, backToSearch);
        }
      } catch (e) {
        console.log('catch', e);
        console.log('name:', query.name);
        throw 'Error during command execution';
      }
      // console.log('results data', resultsData);
      return resultsData;
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

  async function processQSync(params) {
    /*
      params: {
        search: ,
        queue: ,
        start: ,
        end: ,
      }
    */
    return new Promise(async (resolve, reject) => {
      let target;
      let id;
      try {
        target = await CDP.New(cdpOptions);
        console.log('target', target);
        for (let i = params.start; i <= params.end; i ++) {
          // we save a copy of id so when we use it for logging we don't get an
          // incremented version of the iterator
          id = i;
          console.log('requesting id', id);
          let result = await singleEntityRequest(id, target);
          // console.log('id', id, 'result', result);
          // NOTE: if there is an error in fetching the result, it's possible
          // this can come back as `null`. This happens when there is an error
          // on the state website. This happens at least with entity 13023

          if (result === undefined) {
            models.Corp.upsert({
              id: id,
            }).then(inserted => {
              // console.log(`undefined was inserted`);
            }).catch(e => {
              console.log('upsert caught', e);
            });
          } else if (result === null) {
            console.log('[Warn]: entity with null result:', id);
            models.Corp.upsert({
              id: id,
              name: '[Error]',
            }).then(inserted => {
              // console.log(`undefined was inserted`);
            }).catch(e => {
              console.log('upsert caught', e);
            });
          } else {
            models.Corp.upsert({
              id: id,
              name: result.name,
              namesHistory: result.namesHistory,
              details: result.details,
              officers: result.officers,
            }).then(inserted => {
              // console.log(`entity was inserted`);
            }).catch(e => {
              console.log('upsert caught', e);
            });
          }
          searchEmitter.emit('event', {search: params.search.id, start: params.start, end: params.end, queue: params.queue, status: 'in-progress', id: id});
          // although in-progress and target.id aren't really that dynamic we
          // set them here because we have access to them here and if for some
          // reason they did change we can be sure they'll be kept current here
          await params.search
            .set(`queues.${params.queue}.status`, 'in-progress')
            .set(`queues.${params.queue}.targetId`, target.id)
            .set(`queues.${params.queue}.id`, id)
            .save();
        }
        searchEmitter.emit('event', {search: params.search.id, start: params.start, end: params.end, queue: params.queue, status: 'complete', id: id});
        await params.search
          .set(`queues.${params.queue}.status`, 'complete')
          .set(`queues.${params.queue}.id`, id)
          .save();
      } catch (e) {
        searchEmitter.emit('event', {search: params.search.id, start: params.start, end: params.end, queue: params.queue, status: 'error', id: id});
        await params.search
          .set(`queues.${params.queue}.status`, 'error')
          .set(`queues.${params.queue}.id`, id)
          .save();
        console.log('queue failure', e);
        await CDP.Close({ ...cdpOptions, ...{id: target.id}});
        reject(e);
      } finally {
        try {
          // console.log('closing the tab', target.id);
          await CDP.Close({ ...cdpOptions, ...{id: target.id}});
        } catch (e) {
          // console.log('error closing the tab', e);
        }

      }
      resolve(true);
    });
  }

  async function delay(ms) {
    return new Promise((res) => {
      return setTimeout(res, ms);
    });
  }

  async function singleEntityRequest(entityId, target) {
    let client;
    let resultData;
    try {
      // console.log('using passed CDP target', target)
      // console.log('creating new CDP client')
      client = await CDP({target: target});
      const {Page, Network, Runtime} = client;
      await Network.enable();
      await Network.clearBrowserCookies();
      await Page.enable();
      let tries = 0;
      let maxTries = 6;
      let pageTitle;
      let shouldRetry;
      do {
        shouldRetry = false;
        await Page.navigate({url: 'https://www.corporations.pa.gov/search/corpsearch'});
        await Page.loadEventFired();
        pageTitle = await executeCommands(Page, Runtime,
          ['return JSON.stringify(document.title);']
        );
        tries ++;
        if (pageTitle == "Runtime Error") {
          console.log("Runtime Error: try ", tries, "; entity ", entityId);
          shouldRetry = true;
          await delay(5000); // wait 5 seconds before trying again
        } else if (pageTitle == "The URL you requested has been blocked") {
          console.log("Request Blocked: try ", tries, "; entity ", entityId);
          shouldRetry = true;
          await delay(10000); // wait 10 seconds before trying again
        }
        // if our tries are are at (or somehow exceeded) our maxTries and we are
        // still wanting to retry, don't. Log it out and throw an error.
        if (tries >= maxTries && shouldRetry) {
          console.log("Retried Request five times in a row. Giving Up.");
          throw "Retried Request five times in a row. Giving Up.";
        }
      } while (tries < maxTries && shouldRetry);

      try {
        let getNumResults = [
          `
          document.getElementById('txtSearchTerms').value = "${entityId}";
          document.getElementById('btnSearch').click();
          `,
          'wait',
          `
          let change = new Event("change");
          document.getElementsByName('gvResults_length')[0].value = "-1";
          document.getElementsByName('gvResults_length')[0].dispatchEvent(change);
          `,
          `
          let corps = document.querySelectorAll('#gvResults tbody tr td a#lnkBEName');
          return JSON.stringify(corps.length);
          `,
        ];
        let numResults = await executeCommands(Page, Runtime, getNumResults);
        if (numResults > 0) {
          let i = 0;
          let getResultData = [
            `
            let change = new Event("change");
            document.getElementsByName('gvResults_length')[0].value = "-1";
            document.getElementsByName('gvResults_length')[0].dispatchEvent(change);
            `,
            `
            let corps = document.querySelectorAll('#gvResults tbody tr td a#lnkBEName');
            corps[${i}].click();
            `,
            'wait',
            `
            let name = document.querySelectorAll('#gvBusinessNameHistory tbody tr td')[0].innerText;
            let namesHistory = [];
            let namesTableRows = document.querySelectorAll('#gvBusinessNameHistory tbody tr');
            for (let row of namesTableRows) {
              if (row.children.length >= 2 && row.children[1].innerText !== "") {
                let obj = {};
                obj[row.children[1].innerText] = row.children[0].innerText;
                namesHistory.push(obj);
              }
            }

            let detailsParent = document.querySelectorAll('#namedetails')[0].parentNode;
            // console.log(detailsParent);

            let tableIndex;
            for (let index = 0; index < detailsParent.children.length; index++) {
              let childElement = detailsParent.children[index];
                // console.log(childElement);
                if (childElement.id == 'namedetails') {
                  tableIndex = index + 2;
                }
            }
            // console.log(tableIndex)
            let table = detailsParent.children[tableIndex];
            // console.log(table);
            let corpTable = table.children[0].children[0];
            // console.log('corpTable', corpTable);
            let corpRows = corpTable.children[0].children;
            let details = {};
            for (let row of corpRows) {
              if (row.children.length >= 2 && row.children[1].innerText !== "") {
                details[row.children[0].innerText] = row.children[1].innerText
              }
            }

            let hasOfficers = false;
            let officers = [];
            if (table.children[1].children.length) {
              hasOfficers = true;
              let officersTable = table.children[1].children[0];
              let officersRows = officersTable.children[0].children;
              // console.log('officersRows', officersRows);
              let officer = {};
              for (let row of officersRows) {
                if (row.children.length >= 2 && row.children[1].innerText !== "") {
                  officer[row.children[0].innerText] = row.children[1].innerText
                } else if (row.children.length < 2) {
                  officers.push(officer);
                  officer = {};
                }
              }
              officers.push(officer);
            }

            let result = {
              name: name,
              namesHistory: namesHistory,
              details: details,
            };
            if (hasOfficers) {
              result.officers = officers;
            }
            return JSON.stringify(result);
            `
          ];
          resultData = await executeCommands(Page, Runtime, getResultData);
          // console.log('result data', resultData);

        }

        // return null;

      } catch (e) {
        try {
          console.log('catch', e);
          console.log('name:', query.name);
          await client.close();
        } catch (e) {
          console.log('failure during client close in finally', e);
        }
        throw 'Oh No!';
      }

    } catch (err) {
        console.error('Error during singleEntityRequest', err);
    } finally {
        if (client) {
          try {
            await client.close();
          } catch (e) {
            console.log('Error druing singleEntityRequest, finally:client.close()', e);
          }
        }
        return resultData;
    }
  }

  function queryOptions(filters) {
    if (Object.prototype.hasOwnProperty.call(filters, 'type')) {

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

  async function processAndUpdateSearchables(start, end) {
    const { preProcessAddress, preProcessName } = require('./corp.helpers.js');
    let getParams = {
      start: start,
      end: end,
    };
    // do a getAll of the corps between start and end
    // we're going to process them as a batch, generating a new array of names and addresses for the corps
    // we're going to try and do a bulk upsert of the names and addresses into the names and addresses tables
    // the thing is, we basically need to completely rewrite all names and addresses for that range of corps
    // not so much a problem for the first run, but in later runs, we don't want to get orphaned/out of date info for corps that have changed
    // let's do this by doing a transaction where we delete all names and addresses for that range of corps
    // and then we'll do a bulk create for the array of names and addresses

    // This will lead to new name and address ids being generated. Is this a problem?
    // should name and address have their own id, or should it just be a cumulative key of CorpId, type, position?
    // They will have their own guid for now.
    let addresses = [];
    let names = [];
    try {
      console.time('getCorps');
      let corps = await getCorpsForSearchables(getParams);
      console.timeEnd('getCorps');
      console.log('corps length', corps.length);

      console.time('processCorps');
      for (let corp of corps) {
        let corpId = corp.id;
        if (corp.details !== null && corp.details.hasOwnProperty('Address')) {
          let address = corp.details['Address'];
          addresses.push({
            CorpId: corpId,
            source: 'details',
            address: corp.details['Address'],
            searchableAddressV1: preProcessAddress(address),
          });
        }
        if (corp.namesHistory !== null) {
          for (let i = 0; i < corp.namesHistory.length; i++) {
            let nameObj = corp.namesHistory[i];
            // namesHistory objects have one property, the value being the name
            let nameKey = Object.getOwnPropertyNames(nameObj)[0]
            let name = nameObj[nameKey];
            names.push({
              CorpId: corpId,
              source: 'namesHistory',
              position: i,
              name: name,
              searchableNameV1: preProcessName(name),
            });
          }
        }
        if (corp.officers !== null) {
          for (let i = 0; i < corp.officers.length; i++) {
            let officer = corp.officers[i];
            if (officer.hasOwnProperty('Address')) {
              let address = officer['Address']
              addresses.push({
                CorpId: corpId,
                source: 'officers',
                position: i,
                address: address,
                searchableAddressV1: preProcessAddress(address),
              });
            }
            if (officer.hasOwnProperty('Name')) {
              let name = officer['Name'];
              names.push({
                CorpId: corpId,
                source: 'officers',
                position: i,
                name: name,
                searchableNameV1: preProcessName(name),
              });
            }
          }
        }
      }
      console.timeEnd('processCorps');
    } catch (e) {
      console.log('error', e);
      throw "Request Failed";
    }

    console.time('clearAndInsert');
    try {
      let addressAction = await models.sequelize.transaction(async (t) => {
        let addressesDelete = await models.Address.destroy({
          where: {
            CorpId: {
              [Op.gte]: start,
              [Op.lte]: end,
            }
          }
        });
        let addressesCreate = await models.Address.bulkCreate(addresses);
      });
      let nameAction = await models.sequelize.transaction(async (t) => {
        let namesDelete = await models.Name.destroy({
          where: {
            CorpId: {
              [Op.gte]: start,
              [Op.lte]: end,
            }
          }
        });
        let namesCreate = await models.Name.bulkCreate(names);
      });
    } catch (e) {
      console.log('transaction error');
      console.log(e);
    }
    console.timeEnd('clearAndInsert');

    return;

  }

  function getCorpsForSearchables(params) {
    let start = params.start;
    let end = params.end;
    // get corps with id between (and including) start-end, where the name is
    // not null, and either the namesHistory, details or officers is not null
    return models.Corp.findAll({
      where: {
        [Op.and]: {
          id: {
            [Op.gte]: start,
            [Op.lte]: end,
          },
          [Op.or]: {
            namesHistory: {[Op.not]: null},
            details: {[Op.not]: null},
            officers: {[Op.not]: null},
          }
        }
      },
      raw: true,
    });
  }

  async function ensureSearch(request) {
    let searchId = request.params.searchId;
    let search;
    try {
      search = await models.Search.findByPk(searchId);
    } catch (e) {
      throw Boom.badImplementation('Error during models.Search.findByPk(searchId).', e);
    }
    if (search === null) {
      throw "No result for that search ID";
    }
    return search;
  }

};
