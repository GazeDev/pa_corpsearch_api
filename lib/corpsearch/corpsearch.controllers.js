module.exports = () => {
  // const Boom = require('@hapi/boom');
  // const used = process.memoryUsage().heapUsed / 1024 / 1024;
  // console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  return {
    getCorps: async function(request, h) {
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

    }
  };

};
const CDP = require('chrome-remote-interface');
async function requestToCorpSearchPortal(query) {
    let client;
    try {
      // connect to endpoint
      client = await CDP();
      // extract domains
      const {Network, Page, Runtime} = client;
      // setup handlers
      // Network.requestWillBeSent((params) => {
      //     console.log(params.request.url);
      // });
      // enable events then start!
      await Network.enable();
      await Page.enable();
      await Page.navigate({url: 'https://www.corporations.pa.gov/search/corpsearch'});
      await Page.loadEventFired();

      // let commands = [
      //   `document.getElementById('txtSearchTerms').value = "${query.name}";`,
      //   `document.getElementById('btnSearch').click();`,
      //   'wait',
      //   `let corps = document.querySelectorAll('#gvResults tbody tr td a');`,
      //   // `corps[0].click();`,
      //   `corps[0].innerText;`,
      // ];

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
        console.log('executing getNumResults');
        let numResults = await executeCommands(Page, Runtime, getNumResults);
        console.log('numResults', numResults);
        //  TODO: make sure the select is set to 'ALL' and the page data reflects that. "lobos" is good to test with since it has 27 results

        for (let i = 0; i < numResults; i++) {
        // for (let i = 0; i < 1; i++) {
          console.log('getting result', i);
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
        throw 'Oh No!';
      }

      return resultsData;
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
          await client.close();
        }
    }
}

function queryOptions(filters) {
  if (Object.prototype.hasOwnProperty.call(filters, 'type')) {

  }
}

async function executeCommands(Page, Runtime, commands) {
  let result;
  let count = 0;
  for (let command of commands) {
    console.log(`executing command ${count}/${commands.length-1}`);
    if (command == 'wait') {
      // console.log('waiting...');
      await Page.loadEventFired();
      // console.log('waiting over');
    } else {
      // console.log('running command');
      result = await Runtime.evaluate({expression: `(()=>{
        ${command}
      })();`});
    }
    count ++;
  }
  console.log('result', result);

  if (result.result.type == 'undefined') {
    return null;
  }
  return JSON.parse(result.result.value);
}
