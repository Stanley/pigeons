var Pigeons = require('pigeons').Client
  , request = require('request')

describe('local cache check', function(){

  var server, db, logs;
  beforeEach(function(){
    server = s.createServer(5000, function(){
      db = s.createServer(5001, function(){
        logs = s.createServer(5002, function(){});
      });
    });
    waitsFor(function(){return server && db && logs})
  });

  afterEach(function(){
    server.close(); db.close(); logs.close();
    server = db = logs = undefined;
  });

  it('should retrieve and remember all recent timetables', function(){

    var pigeons, finished;
    pigeons = new Pigeons({server:'http://localhost:5000', home:'/'}, function(){
      this.log = 'http://localhost:5002';
    });
    spyOn(pigeons, 'logger').andCallFake(function(){ finished = true });

    // Return etags of most recent request to timetables which haven't expired in the database
    logs.once('request',
      s.createResponse(JSON.stringify({rows:[
        {key:['http://mpk.krakow.pl/timetables/1'], value:{etag:'foo'}}
      ]}))
    );
    server.once('/', s.createResponse(CreateDocument()));
    
    pigeons.getAll();

    waitsFor(function(){return finished}, 'logs', 200);
    runs(function(){
      expect(pigeons.existing['http://mpk.krakow.pl/timetables/1']).toEqual({etag:'foo'})
    });
  });

  describe('valid_from', function(){

    it('should update valid_until field when outdated', function(){
      var request;
      new Pigeons({server:'http://localhost:5000', home:'/'}, function(){
        this.db = 'http://localhost:5001';
        this.existing = {'http://example.com/timetable/1':{ id:'foo' }}
        this.getAll();
      });

      server.once('/', s.createResponse(''));
      db.once('request', function(req,resp){
        request = req;
      });
      
      waitsFor(function(){ return request }, 500, 'update');
      runs(function(){
        expect(request.url).toEqual('/_design/Timetable/_update/dump/foo');
      })
    });

    //it('should not result in timetable update that was not changed on the server', function(){
    it('should generate timetables\'s ids based on source and valid_from fields', function(){

      var ready, source = 'http://example.com/timetable.html', requests = [];
      var first_doc = {source:source, updated_at:'2011-07-01', valid_from:'2011-01-01'}
      var second_doc = {source:source, updated_at:'2011-07-05', valid_from:'2011-01-01'}

      db.on('request', function(req,resp){
        requests.push(req.url)
        return s.createResponse("conflict", 409)(req,resp)
      });

      var pigeons = new Pigeons({db: 'http://localhost:5001'});
      pigeons.put(first_doc, '');
      pigeons.put(second_doc, '', function(){ ready = true });

      waitsFor(function(){ return ready }, 500, 'two responses');
      runs(function(){
        expect(requests[0]).toEqual(requests[1]);
      });
    });
  });
});
