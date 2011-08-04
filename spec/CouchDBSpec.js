describe('couchdb', function(){

  var request = require('request');
  var database = 'http://localhost:5984/test_pigeons2';

  var saved;
  request({method: 'DELETE', uri: database}, function(){
    request({method: 'PUT', uri: database}, function(err){
      new Pigeons({db: database}, function(){
        this.put({_id: "5318008", foo: "bar"}, "<html>Hello!</html>", function(err, resp, body){
          saved = !err;
        });
      });
    });
  });

  beforeEach(function(){
    waitsFor(function(){ return saved; }, 'Could not create a database', 200);
  })

  describe('document', function(){

    var doc;
    beforeEach(function(){
      request({uri: database +'/5318008'}, function(err, resp, body){
        doc = JSON.parse(body);
      });
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
