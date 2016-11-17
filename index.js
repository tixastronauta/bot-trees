var path = require('path');
var express = require('express');
var port = process.env.PORT || 3978;

var app = express();
var botApi = require('./bot');

// endpoint for bot framework
app.post('/api/messages', botApi.connector.listen());

// endpoint for loading SMARKIO chats
app.get('/api/load/:scenario', (req, res) => {
  var scenario = req.params.scenario;
  console.log(`loading scenario: ${scenario}`);
  botApi.loadDynamicScenario(scenario);
  return res.end('loading scenario ${scenario}');
});

app.listen(port, function () {
  console.log('listening on port %s', port);
});

