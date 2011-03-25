var Pigeons = require('pigeons').Client;

describe('couchdb', function(){

  var request = require('request');
  var database = 'http://localhost:5984/test_pigeons2';

  var db;
  request({method: 'DELETE', uri: database}, function(){
    var config = {db: database};
    var pigeons = new Pigeons(config, function(){
      pigeons.put({_id: "5318008", foo: "bar"}, "<html>Hello!</html>", function(err, resp, body){
        db = body;
      });
    });
  });

  beforeEach(function(){
    waitsFor(function(){ return db; }, 'Could not create a database', 200);
  })

  it('should create database', function(){
    var response;

    request({uri: database}, function(err, resp, body){
      response = resp;
    });

    waitsFor(function(){ return response; });

    runs(function(){
      expect(response.statusCode).toEqual(200);
    });
  });

  describe('document', function(){

    var doc;
    waitsFor(function(){ return db; }, 'Could not create a database', 200);
    runs(function(){
      request({uri: database +'/5318008'}, function(err, resp, body){
        doc = JSON.parse(body);
      });
    });
    beforeEach(function(){
      waitsFor(function(){ return doc; }, 'Coould not save a document', 100);
    })

    it('should be saved', function(){
      expect(doc.foo).toEqual("bar");
    });

    it('should add timetable type', function(){
      expect(doc.type).toEqual('Timetable');
      expect(doc.created_at).toBeDefined();
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

    request({uri: database +'/5318008/source.html'}, function(err, resp, body){
      response = resp;
      html = body;
    });

    waitsFor(function(){ return response && html; });

    runs(function(){
      expect(response.headers['content-type']).toEqual("text/html");
      expect(html).toEqual("<html>Hello!</html>");
    });
  });
});
