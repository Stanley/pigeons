request = require('request');
Jsdom = require('jsdom');
Iconv = require('iconv').Iconv;

s = require('./server');
Pigeons = require('./../lib/pigeons.js');

var NodeSizzle = require('./../lib/node-sizzle.js').Sizzle;
var sizzle = new NodeSizzle();

console.log = function(){}

CreateDocument = function(body){
  return '<html><head></head><body>'+ body +'</body></html>';
};

Sizzle = function(body){
  return sizzle.run(Dom(body).document);
}

Dom = function(body){
  return Jsdom.jsdom(CreateDocument(body), null, {url: '/'}).createWindow()
}
