var Pigeons = require('pigeons').Client;

describe('couchdb', function(){

  var request = require('request');
  var database = 'test_pigeons';
  var uri = 'http://localhost:5984/'+ database;

  var db;
  request({method: 'DELETE', uri: uri}, function(){
    var config = {code: database};
    var pigeons = new Pigeons(config);
    pigeons.put({_id: "5318008", foo: "bar"}, "<html>Hello!</html>", function(err, resp, body){
      db = body;
    });
  });

  beforeEach(function(){
    waitsFor(function(){ return db; }, 'Cound not save a document.', 500);
  })

  it('should create database', function(){
    var response;

    request({uri: uri}, function(err, resp, body){
      response = resp;
    });

    waitsFor(function(){ return response; });

    runs(function(){
      expect(response.statusCode).toEqual(200);
    });
  });

  describe('document', function(){
    var doc;
    request({uri: uri +'/5318008'}, function(err, resp, body){
      doc = body;
    });
    waitsFor(function(){ return doc; });

    it('should be saved', function(){
      expect(doc.foo).toEqual("bar");
    });

    it('should create timestamp', function(){
      expect(doc.created_at).toBeDefined();
    });

    it('should use only one request', function(){
      expect(doc._rev.split('-')[0]).toEqual('1');
    });
  });

  it('should save html source', function(){
    var response, html;

    request({uri: uri +'/5318008/source.html'}, function(err, resp, body){
      response = resp;
      html = body;
    });

    waitsFor(function(){ return response && html; });

    runs(function(){
      expect(response.headers).toEqual("text/html");
      expect(html).toEqual("<html>Hello!</html>");
    });
  });
});
