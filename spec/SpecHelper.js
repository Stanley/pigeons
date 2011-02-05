require.paths.push('./lib');

Jsdom = require('jsdom');
Pigeons = require('pigeons.js').Client;

var NodeSizzle = require('node-sizzle.js').Sizzle;
var sizzle = new NodeSizzle();

CreateDocument = function(body){
  return '<html><head></head><body>'+ body +'</body></html>';
};

Sizzle = function(body){
  return sizzle.run(Jsdom.jsdom(CreateDocument(body), null, {url: '/'}).createWindow().document);
}
