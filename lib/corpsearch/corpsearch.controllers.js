module.exports = (models) => {
  // const Boom = require('@hapi/boom');
  // const used = process.memoryUsage().heapUsed / 1024 / 1024;
  // console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  const Sequelize = require('sequelize');
  const Op = Sequelize.Op;
  const CDP = require('chrome-remote-interface');
  const cdpOptions = {
    host: 'chrome'
  };
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
        // console.log('request params', request.query);
        let start = request.query.start;
        let end = request.query.end;
        let queues = request.query.queues;
        let diff = end - start;
        let count = diff + 1; // because 'end' is inclusive
        let queueSize = Math.floor(count/queues);
        // console.log('q size:', queueSize);
        let maxQueueSize = Math.ceil(count/queues);
        // console.log('max q size:', maxQueueSize);
        let largerQueues = count % queues;
        // console.log('largerQs:', largerQueues);

        // fill queues with sequential ids. fill as many queues to the max as possible
        // start queues async. each queue processes its items sync
        let enumStart = start;
        for (let qI = 0; qI < queues; qI ++) {
          // console.log('initializing queue', qI);

          let isMaxQueue = (largerQueues - qI > 0);
          let currentQSize = isMaxQueue ? maxQueueSize : queueSize;
          let enumEnd = enumStart + currentQSize -1;
          // console.log(`Q ${enumStart} - ${enumEnd} starting`);
          // we want to start all queues async, so don't await them. each queue
          // itself will run sync though
          processQSync(enumStart, enumEnd);
          enumStart = enumEnd + 1;
        }

        return {
          query: request.query,
          results: `Started query of entities ${request.query.start} - ${request.query.end} using ${queues} queue(s)`,
          // count: results.length,
          // results: results,
        };
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
    getCorps: async function(request, h) {
      try {
        console.log('request params', request.query);
        let results = await getDBCorps(request.query);
        return {
          count: results.length,
          results: results
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
  };

  async function requestToCorpSearchPortal(query) {
      let client;
      try {
        client = await CDP(cdpOptions);
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
          throw 'Oh No!';
        }
        // console.log('results data', resultsData);
        return resultsData;
      } catch (err) {
        console.error(err);
      } finally {
        try {
          if (client) {
            await client.close();
          }
        } catch (e) {
          console.log('error closing in finally', e);
        }
      }
  }

  async function processQSync(start, end) {
    return new Promise(async (resolve, reject) => {
      let target;
      try {
        target = await CDP.New(cdpOptions);
        for (let id = start; id <= end; id ++) {
          console.log('requesting id', id);
          let result = await singleEntityRequest(id, target);
          // console.log('id', id, 'result', result);
          if (result === undefined) {
            models.Corpsearch.upsert({
              id: id,
            }).then(inserted => {
              // console.log(`undefined was inserted`);
            }).catch(e => {
              console.log('upsert caught', e);
            });
          } else {
            models.Corpsearch.upsert({
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

        }
      } catch (e) {
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

  async function singleEntityRequest(entityId, target) {
    let client;
    let resultData;
    try {
      // console.log('using passed CDP target', target)
      // console.log('creating new CDP client')
      client = await CDP({target: target});
      const {Page, Runtime} = client;
      await Page.enable();
      await Page.navigate({url: 'https://www.corporations.pa.gov/search/corpsearch'});
      await Page.loadEventFired();

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
        console.error('err', err);
    } finally {
        if (client) {
          try {
            // console.log('closing client');
            await client.close();
            // console.log('client closed');
          } catch (e) {
            console.log('error closing in finally', e);
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
      console.log('error executing command');
      return null;
    }
  }

  function getDBCorps(query = {}) {
    let whereOptions = { id: {}};
    if (query.start) {
      whereOptions.id[Op.gte] = query.start;
    }
    if (query.end) {
      whereOptions.id[Op.lte] = query.end;
    }
    let options = {
      order:[['id', 'ASC']],
      where: whereOptions,
    };
    console.log(options)
    return models.Corpsearch.findAll(options);
  }

};
