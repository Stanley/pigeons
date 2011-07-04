var Pigeons = require('pigeons').Client
  , request = require('request')

describe('local cache check', function(){

  var server, db, logs;
  beforeEach(function(){
    server = s.createServer(6000, function(){
      db = s.createServer(6001, function(){
        logs = s.createServer(6002, function(){});
      });
    });
    waitsFor(function(){return server && db && logs})
  });

  afterEach(function(){
    server.close(); db.close(); logs.close();
    server = db = logs = undefined;
  });

  it('should retrieve all recent timetables', function(){

    var pigeons, updated;
    pigeons = new Pigeons({
      server: 'http://localhost:6000',
      home  : '/',
    }, function(){
      this.db = 'http://localhost:6001';
      this.getAll();
    });

    db.once('/_design/Timetable/_view/active', s.createResponse(JSON.stringify({rows: [
        { value: { _id: 'foo', type: 'Timetable', source: 'http://mpk.krakow.pl/timetables/1', valid_from: '21.01.2011' }}
      ]})));
    db.once('/_design/Timetable/_update/dump/foo?new_doc_since=null', function(req, resp){
      updated = true;
    });
    server.once('/', s.createResponse(CreateDocument()));

    waitsFor(function(){return updated}, 'logs', 200);
    runs(function(){
      expect(pigeons.existing['http://mpk.krakow.pl/timetables/1']).toBeDefined();
      expect(pigeons.existing['http://mpk.krakow.pl/timetables/1'].valid_from).toEqual('21.01.2011')
    })
  });

  describe('valid_from', function(){

    // TODO
    it('should result in timetable update when outdated');

    it('should not result in timetable update that was not changed on the server', function(){

      var finish, callback = jasmine.createSpy();
      var html = "<div class=\"valid_from\">28.01.2011</div>";
      var pigeons = new Pigeons({ server: 'http://localhost:6000', get: { valid_from: '.valid_from' }});

      spyOn(pigeons, 'put');
      server.once('/timetables/2', function(req,resp){
        finish = true; s.createResponse(CreateDocument(html))(req,resp)
      });

      pigeons.existing = {'http://localhost:6000/timetables/2': {valid_from: '28.01.2011'}};
      pigeons.getTimetable('/timetables/2', callback);

      waitsFor(function(){ return finish });
      runs(function(){
        expect(pigeons.put).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
      });
    });
  });
});
