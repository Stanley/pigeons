require.paths.push('./lib');

Jsdom = require('jsdom');
Pigeons = require('pigeons.js').Client;

var sizzle = require('node-sizzle.js')

CreateDocument = function(body){
  return '<html><head></head><body>'+ body +'</body></html>';
};

Sizzle = function(body){
  return sizzle.loadSizzle(Jsdom.jsdom(CreateDocument(body), null, {url: '/'}).createWindow().document)
}
