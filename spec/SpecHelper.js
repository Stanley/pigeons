require.paths.push('./lib');

request = require('request')
Jsdom = require('jsdom');
Pigeons = require('pigeons.js').Client;
console.log = function(){}

var NodeSizzle = require('node-sizzle.js').Sizzle;
var sizzle = new NodeSizzle();

CreateDocument = function(body){
  return '<html><head></head><body>'+ body +'</body></html>';
};

Sizzle = function(body){
  return sizzle.run(Jsdom.jsdom(CreateDocument(body), null, {url: '/'}).createWindow().document);
}
