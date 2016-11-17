var request = require('request');
var path = require('path');
var builder = require('botbuilder');
var BotGraphDialog = require('bot-graph-dialog');
var GraphDialog = BotGraphDialog.GraphDialog;

var config = require('../config');
var fs = require('fs');

var microsoft_app_id = config.get('MICROSOFT_APP_ID');
var microsoft_app_password = config.get('MICROSOFT_APP_PASSWORD');

var connector = new builder.ChatConnector({
    appId: microsoft_app_id,
    appPassword: microsoft_app_password,
  });
  
var bot = new builder.UniversalBot(connector);
var intents = new builder.IntentDialog();

// this flag will become true when the dialog is updated
var isScenarioDirty = false;

// middleware to intercept user messages
// if dialog is dirty, we will reset the session
bot.use({
  botbuilder: function(session, next) {
    if (isScenarioDirty) {
      isScenarioDirty = false;
      session.send("Dialog updated. We'll have to start over.");
      session.reset("/");
      return;
    }
    return next();
  }
});

module.exports = {
  connector,
  loadDynamicScenario
};

var handlersPath = path.join(__dirname, 'handlers');

bot.dialog('/', intents);

// first scenario to show: 197
loadDynamicScenario(197, true);


// dynamically load dialog from a remote datasource (SMARKIO chatbot JSON API)
// create a GraphDialog and bind it to the intents object
function loadDynamicScenario(scenario, isClean) {

  var dialogPath = `/${scenario}`;
  var re = new RegExp(".", 'i');
  if (intents.handlers[re.toString()])
  {
    console.log(`deleting existing handler: ${re.toString()}`);
    delete intents.handlers[re.toString()];
  }

  intents.matches(re, [
    function (session) {
      session.beginDialog(dialogPath, {});
    }
  ]);

  GraphDialog
    .fromScenario({
      bot,
      scenario: scenario,
      loadScenario: loadRemoteScenario,
      loadHandler,
      customTypeHandlers: getCustomTypeHandlers()
    })
    .then(graphDialog => {

      if (bot.lib.dialogs[`/${scenario}`])
      {
        console.log(`deleting existing scenario ${scenario}`);
        delete bot.lib.dialogs[`/${scenario}`];
      }

      bot.dialog(dialogPath, graphDialog.getDialog());

      if ("undefined" == typeof isClean)
      {
        console.log(`marking scenario as dirty`);
        isScenarioDirty = true;
      }

      console.log(`graph dialog loaded successfully: scenario ${scenario}`);
    })
    .catch(err => { console.error(`error loading dialog: ${err.message}`); });
}

// this allows you to extend the json with more custom node types, 
// by providing your implementation to processing each custom type.
// in the end of your implemention you should call the next callbacks
// to allow the framework to continue with the dialog.
// refer to the customTypeStepDemo node in the stomachPain.json scenario for an example.
function getCustomTypeHandlers() {
  return [
    {
      name: 'myCustomType',
      execute: (session, next, data) => {
        console.log(`in custom node type handler: customTypeStepDemo, data: ${data.someData}`);
        return next();
      }
    },
    {
      name: "smarkioSubmit",
      execute: (session, next, data) => {
        var form = "undefined" != typeof data.postParameters ? data.postParameters : {};
        for (var prop in session.dialogData) {
          form[prop] = session.dialogData[prop];
        }
        var options = {
          url: data.url,
          form: form
        };
        request.post(options, function(error, response, body) {
          console.log(error);
          console.log(body);
        });
        return next();
      }
    }
  ];
}


// this handler loads remote scenarios from SMARKIO chatbot JSON API
function loadRemoteScenario(scenario) {
  return new Promise((resolve, reject) => {

    console.log(`loadRemoteScenario: ${scenario}`);

    var uri = `http://c44a5867.ngrok.io/index.php/chat/json/${scenario}`;
    console.log(`loading remote scenario ${scenario} from ${uri}`);

    request(uri, {}, function (error, response, body) {

      console.log(`resolving remote scenario... `);
      console.log(body);
      resolve(JSON.parse(body));

    });

  });
}

// this is the handler for loading handlers from external datasource
// in this implementation we're just reading it from a file
// but it can come from any external datasource like a file, db, etc.
//
// NOTE:  handlers can also be embeded in the scenario json. See scenarios/botGames.json for an example.
function loadHandler(handler) {
  return new Promise((resolve, reject) => {
    console.log('loading handler', handler);
    // implement loadHandler from external datasource.
    // in this example we're loading from local file
    var handlerPath = path.join(handlersPath, handler);
    var handlerString = null;
    return fs.readFile(handlerPath, 'utf8', (err, content) => {
      if (err) {
        console.error("error loading handler: " + handlerPath);
        return reject(err);
      }
      // simulating long load period
      setTimeout(() => {
        console.log('resolving handler', handler);
        resolve(content);
      }, Math.random() * 3000);
    });  
  });
}