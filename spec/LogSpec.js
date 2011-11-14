describe('logger', function(){

  var server, db, logs;
  beforeEach(function(){
    server = s.createServer(4000, function(){
      db = s.createServer(4001, function(){
        logs = s.createServer(4002, function(){});
      });
    });
    waitsFor(function(){return server && db && logs})
  });

  afterEach(function(){
    server.close(); db.close(); logs.close();
    server = db = logs = undefined;
  });

  it('should log all visited pages', function(){
    var log, pigeons = new Pigeons({ server: 'http://localhost:4000' });

    spyOn(pigeons, 'logger');
    server.once('request', s.createResponse(''))
    pigeons.get('/');

    waitsFor(function(){ return log = pigeons.logger.argsForCall[0]; }, 'request', 2000);
    runs(function(){
      expect(log[0].uri).toEqual('http://localhost:4000/');
      expect(log[0].headers).toBeDefined();
      expect(log[0].statusCode).toEqual(200);
    })
  });

  it('should log saved timetables', function(){
    var pigeons = new Pigeons({ server: 'http://localhost:4000' });

    spyOn(pigeons, 'logger');
    server.once('request', s.createResponse(''))
    pigeons.getTimetable('/');

    waitsFor(function(){ return pigeons.logger.mostRecentCall.args }, 'request', 2000);
    runs(function(){
      var log = pigeons.logger.mostRecentCall.args[0];
      expect(log.uri).toEqual('http://localhost:4000/');
      expect(log.type).toEqual('Timetable');
      expect(log.headers).toBeDefined();
      expect(log.statusCode).toEqual(200);
    })
  });

  it('should log times of source and db requests', function(){
    var log;

    server.once('request', s.createResponse('')); // Return timetable
    db.once('request', s.createResponse(JSON.stringify({ ok: true, id: 'foo', rev: '1-bar' }), 201));
    logs.once('request', function(req, resp){
      var buffer = '';
      req.on('data', function(chunk){ buffer += chunk });
      req.on('end', function(){
        log = JSON.parse(buffer);
      });
    });

    new Pigeons({ server: 'http://localhost:4000' }, function(){
      this.db = 'http://localhost:4001';
      this.log = 'http://localhost:4002';
      this.getTimetable('/');
    });

    waitsFor(function(){ return log }, 1000, 'log');
    runs(function(){
      expect(log.response_time.remote).toBeDefined();
      expect(log.response_time.db).toBeDefined();
      expect(log.creates).toEqual('http://localhost:4001/foo?rev=1-bar');
    });
  });

  it('should outdate not existing timetables and log them', function(){

    var log;

    // Return _design.couchapp/_view/revent_timetables
    logs.once('request', function(req,resp){
      logs.on('/', function(req, resp){
        var buffer = '';
        req.on('data', function(chunk){ buffer += chunk });
        req.on('end', function(){ log = JSON.parse(buffer) });
      });

      return s.createResponse(JSON.stringify({rows: [
        {key:['http://localhost:4000','/timetables/1'], value:{id:'', etag:'foo'}} //todo id=''??
      ]}))(req,resp)
    });

    db.once('request', s.createResponse(''))
    server.once('request', s.createResponse(''));

    spyOn(new Pigeons({}, function(){
      this.log = 'http://localhost:4002';
      this.db = 'http://localhost:4001';
      this.getAll();
    }), 'get').andCallFake(function(){
      this.get.mostRecentCall.args[1]();
    })

    waitsFor(function(){ return log }, 'log', 1000);
    runs(function(){
      expect(log.type).toEqual('Outdated');
      expect(log.uris).toEqual([ 'http://localhost:4000/timetables/1' ]);
    })
  });
  
  it('should outdate timetables (newer avaliable)', function(){
    var callback = jasmine.createSpy();
    var logged = [], finished;

    // Return _design.couchapp/_view/revent_timetables
    logs.once('request', function(req,resp){
      // Catches logs
      logs.on('request', function(req, resp){
        var buffer = '';
        req.on('data', function(chunk){ buffer += chunk });
        req.on('end', function(){
          logged.push(JSON.parse(buffer));
          resp.writeHead(201, {'content-type':'application/json'});
          resp.write(JSON.stringify({ok: true}));
          resp.end();
        });
      });
      // etag value doesn't matter since it's not MD6
      return s.createResponse(JSON.stringify({rows: [
        {key:['http://localhost:4000','/timetables/1'], value:{id:'foo', etag:'foo'}}
      ]}))(req,resp);
    });

    // Saves new doc in database
    db.once('request', function(req,resp){
      // Updates old document
      db.once('/_design/Timetable/_update/dump/foo?new_doc_since=14.03.2011', function(req,resp){
        callback()
        return s.createResponse('ok')(req,resp)
      });
      return s.createResponse('{"ok": true}')(req,resp)
    })

    server.once('/', s.createResponse("<html><body><div><a href=\"/lines/1\">1</a></div></body></html>"))
      .once('/lines/1', s.createResponse("<html><body><div><a href=\"/timetables/1\">1</a></div></body></html>"))
      .once('/timetables/1', s.createResponse("<html><body><div class=\"valid_from\">14.03.2011</div></body></html>"));

    var config = {
      server:'http://localhost:4000', home:'/',
      get:{ lines:'a', timetables:'a', valid_from:'.valid_from' }
    }
    new Pigeons(config, function(){
      this.db = 'http://localhost:4001';
      this.log = 'http://localhost:4002';
      this.getAll(function(){ finished = true });
    });

    waitsFor(function(){ return finished }, 'request', 1000);
    runs(function(){
      expect(logged[3].type).toEqual('Outdated')
      expect(logged[3].uris).toEqual(['http://localhost:4000/timetables/1'])
      expect(callback).toHaveBeenCalled();
    })
  });

  it('should log requests of timetables which do not requre update', function(){
    var log;

    // Return timetable which doesn't require update
    server.once('/timetable/1', s.createResponse(null, 304))
    // Catch log
    logs.once('/', function(req, resp){
      var buffer = '';
      req.on('data', function(chunk){ buffer += chunk });
      req.on('end', function(){
        log = JSON.parse(buffer);
      });
    });
  
    new Pigeons({ server: 'http://localhost:4000', get: { valid_from: 'div' }}, function(){
      this.log = 'http://localhost:4002';
      this.existing = {'http://localhost:4000/timetable/1':{}};
      this.getTimetable('/timetable/1');
    });

    waitsFor(function(){ return log }, 1000, 'log');
    runs(function(){
      expect(log.statusCode).toEqual(304);
      expect(log.type).toEqual('Timetable');
      expect(log.uri).toEqual('http://localhost:4000/timetable/1');
      expect(log.response_time.remote).toBeDefined();
      expect(log.creates).toBeUndefined();
      expect(log.updates).toBeUndefined();
    })
  });

  describe('errors', function(){

    it('should log timeouted request', function(){
      var log, count = 0;
      server.on('/', function(req, resp){
        count += 1;
        resp.writeHead(200, {'content-type':'application/json'});
        resp.write("foo");
        setTimeout(function(){
          resp.end();
        }, count == 1 ? 1100 : 0); // Given timeout is 1s
      });

      logs.once('/', function(req, resp){
        var buffer = '';
        req.on('data', function(chunk){ buffer += chunk });
        req.on('end', function(){
          log = JSON.parse(buffer);
        });
      });

      var finished;
      var pigeons = new Pigeons({server:'http://localhost:4000'}, function(){ 
        this.log = 'http://localhost:4002';
        this.get('/', function($, log, body){
          expect(body.toString()).toEqual("foo")
        })
      });

      waitsFor(function(){ return log }, 1500, 'callback');
      runs(function(){
        expect(log.response_time.remote).toBeGreaterThan(1000)
      })
    });

    //it('should log server errors', function(){
      //var log, pigeons = new Pigeons({ server: 'http://httpstat.us',
                                     //log: log,
                                     //db: db});
      //spyOn(pigeons, 'logger').andCallThrough();
      //spyOn(pigeons, 'request').andCallThrough();
      //pigeons.getTimetable('/500');

      //waitsFor(function(){ return pigeons.logger.argsForCall.length }, 'request', 1000);
      //runs(function(){
        //var log = pigeons.request.argsForCall[pigeons.request.argsForCall.length-1][0].json
        //expect(log.uri).toEqual('http://httpstat.us/500');
        //expect(log.statusCode).toEqual(500);
        //expect(log.type).toEqual('Timetable');
      //})
    //});

    //it('should log failed requests', function(){
      //throw 'not implemented'
    //});

    //it('should log database errors', function(){
      //throw 'not implemented'
    //});

    //it('should proceed despite errors', function(){
      //throw 'not implemented'
    //});
  });

  //it('should log to stdout if database does not exist', function(){
    //var pigeons = new Pigeons();
    //spyOn(pigeons, 'log');
    //spyOn(console, 'log');

    //pigeons.get();
    //expect(pigeons.log).toHaveBeenCalledWith({});
    //expect(console.log).toHaveBeenCalledWith("");
  //});
});

// Notice: requires CouchDB to run
describe('couchapp\'s views', function(){
  var db = 'http://localhost:5984/test_logs'
    , design = '/_design/couchapp'
    ;

  describe('most_recent', function(){

    var couchapp;
    // Empty database
    request({uri:db, method:'DELETE'}, function(){ request({uri:db, method:'PUT'}, function(){
      Pigeons.createCouchApp(db, function(){ couchapp = true });
    })})
    beforeEach(function(){ waitsFor(function(){ return couchapp }) });
    
    it('should map requests to it\'s etags', function(){
      var mapped, log = {type:'Timetable', uri:'http://example.com/foo.html', headers:{etag:'bar'}};
      request({uri:db, method:'POST', json:log}, function(err){
        request({uri:db+design+'/_view/recent_timetables?reduce=false'}, function(err,req,resp){
          mapped = JSON.parse(resp)['rows'][0];
        });
      });

      waitsFor(function(){ return mapped }, 500, 'mapped document');
      runs(function(){
        expect(mapped.key[0]).toEqual('http://example.com');
        expect(mapped.key[1]).toEqual('/foo.html');
        expect(mapped.value).toEqual('bar');
      });
    });

    it('should reduce etags to most recent ones', function(){
      var uri = 'http://example.com/bar.html';
      var reduced, logs = {docs:[
        {type:'Timetable', uri:uri, created_at:'2011-06-10', headers:{etag:'a'}},
        {type:'Timetable', uri:uri, created_at:'2011-06-11', headers:{etag:'b'}},
        {type:'Timetable', uri:uri, created_at:'2011-05-12', headers:{etag:'c'}}
      ]};
      request({uri:db+'/_bulk_docs', method:'POST', json:logs}, function(err){
        var view = encodeURI('/_view/recent_timetables?startkey=["http://example.com","/bar.html"]&endkey=["http://example.com","/bar.html",{}]&group_level=2')
        request({uri:db+design+view}, function(err,req,body){
          reduced = JSON.parse(body)['rows'][0];
        });
      });

      waitsFor(function(){ return reduced }, 500, 'reduced document');
      runs(function(){
        expect(reduced.key).toEqual(['http://example.com','/bar.html']);
        expect(reduced.value.etag).toEqual('b');
      })
    });

    it('should not return reduced values of deleted documents', function(){
      var uri = 'http://example.com/foo.bar';
      var reduced, logs = {docs:[
        {type:'Timetable', uri:uri, created_at:'2011-06-10', headers:{etag:'a'}},
        {type:'Timetable', uri:uri, created_at:'2011-06-11', headers:{etag:'b'}},
        {type:'Timetable', uri:uri, created_at:'2011-05-12', headers:{etag:'c'}},
        {type:'Outdated', uris:[uri], created_at:'2011-06-13'}
      ]};
      request({uri:db+'/_bulk_docs', method:'POST', json:logs}, function(err){
        var view = encodeURI('/_view/recent_timetables?startkey=["http://example.com","/foo.bar"]&endkey=["http://example.com","/foo.bar",{}]&group_level=2')
        request({uri:db+design+view}, function(err,req,resp){
          reduced = JSON.parse(resp)['rows'][0];
        });
      });

      waitsFor(function(){ return reduced }, 500, 'reduced document');
      runs(function(){
        expect(reduced.value.type).toEqual('Outdated');
      });
    });
  });
});
