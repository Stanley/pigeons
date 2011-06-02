describe('logger', function(){

  it('should log all visited pages', function(){
    var log, pigeons = new Pigeons({ server: 'http://httpstat.us' });
    spyOn(pigeons, 'logger');

    pigeons.get('/200');
    waitsFor(function(){ return log = pigeons.logger.argsForCall[0]; }, 'request', 2000);
    runs(function(){
      expect(log[0].uri).toEqual('http://httpstat.us/200');
      expect(log[0].headers).toBeDefined();
      expect(log[0].statusCode).toEqual(200);
    })
  });

  it('should log saved timetables', function(){
    var pigeons = new Pigeons({ server: 'http://httpstat.us' });

    spyOn(pigeons, 'logger');
    pigeons.getTimetable('/200');

    waitsFor(function(){ return pigeons.logger.mostRecentCall.args }, 'request', 2000);
    runs(function(){
      var log = pigeons.logger.mostRecentCall.args[0];
      expect(log.uri).toEqual('http://httpstat.us/200');
      expect(log.type).toEqual('Timetable');
      expect(log.headers).toBeDefined();
      expect(log.statusCode).toEqual(200);
    })
  });

  it('should log times of source and db requests', function(){
    var log, logs
      , db = s.createServer(6001, function(){
      logs = s.createServer(6002, function(){
        new Pigeons({ server: 'http://httpstat.us' }, function(){
          this.db = 'http://user:password@localhost:6001';
          this.log = 'http://localhost:6002';
          this.getTimetable('/200');
        });
      }).once('request', function(req, resp){
        var buffer = '';
        req.on('data', function(chunk){ buffer += chunk });
        req.on('end', function(){
          resp.end();
          db.close();
          logs.close();
          log = JSON.parse(buffer);
        });
      });
    }).once('request', s.createResponse(JSON.stringify({ ok: true, id: 'foo', rev: '1-bar' }), 201));

    waitsFor(function(){ return log }, 1000, 'log');
    runs(function(){
      expect(log.response_time.remote).toBeDefined();
      expect(log.response_time.db).toBeDefined();
      expect(log.creates).toEqual('http://localhost:6001/foo?rev=1-bar');
    });
  });

  it('should deprecate not existing timetables and log them', function(){

    var log, finished; //, doc = { type: 'Timetable', valid_from: '13.03.2011', source: 'http://localhost:6000/timetables/1' }
    var db = s.createServer(6001, function(){
      pigeons = new Pigeons({ server: 'http://httpstat.us', home: '/200', db: 'http://localhost:6001' }, function(){
        var logs = s.createServer(6002, function(){
          pigeons.log = 'http://localhost:6002';
          pigeons.getAll(function(){
            logs.close();
            db.close();
            finished = true;
          });
        }).on('request', function(req, resp){
          var buffer = '';
          req.on('data', function(chunk){ buffer += chunk });
          req.on('end', function(){
            resp.writeHead(201, {'content-type':'application/json'});
            resp.write(JSON.stringify({ok: true}));
            resp.end();
            log = JSON.parse(buffer);
          });
        });
      });
    }).once('/_design/Timetable/_view/active', s.createResponse(JSON.stringify({rows: [
        { value: { _id: 'foo', type: 'Timetable', valid_from: '13.03.2011', source: 'http://localhost:6000/timetables/1' }}
      ]})))
      .on('request', s.createResponse('ok'));

    waitsFor(function(){ return finished }, 'log', 1000);
    runs(function(){
      expect(log.type).toEqual('Deprication');
      expect(log.urls).toEqual([ 'http://localhost:6000/timetables/1' ]);
    })
  });
  
  it('should deprecate outdated timetables (newer avaliable)', function(){
    var callback = jasmine.createSpy();
    var log, finished, server = s.createServer(6000, function(){
      pigeons = new Pigeons({ server: 'http://localhost:6000', home: '/',
        get: { lines: 'a', timetables: 'a', valid_from: '.valid_from' } },
        function(){
          var db = s.createServer(6001, function(){
            var logs = s.createServer(6002, function(){
              pigeons.db = 'http://localhost:6001';
              pigeons.log = 'http://localhost:6002';
              pigeons.getAll(function(){
                server.close();
                logs.close();
                db.close();
                finished = true;
              });
            }).on('request', function(req, resp){
              var buffer = '';
              req.on('data', function(chunk){ buffer += chunk });
              req.on('end', function(){
                resp.writeHead(201, {'content-type':'application/json'});
                resp.write(JSON.stringify({ok: true}));
                resp.end();
                log = JSON.parse(buffer);
              });
            });
          }).once('/_design/Timetable/_view/active', s.createResponse(JSON.stringify({rows: [{ value: 
            { _id: 'foo', type: 'Timetable', valid_from: '13.03.2011', source: 'http://localhost:6000/timetables/1' }
          }]})))
            .once('/_design/Timetable/_update/dump/foo?new_doc_since=14.03.2011', callback)
            .on('request', s.createResponse('{"ok": true}'));
        }
      );
    }).once('/', s.createResponse("<html><body><div><a href=\"/lines/1\">1</a></div></body></html>"))
      .once('/lines/1', s.createResponse("<html><body><div><a href=\"/timetables/1\">1</a></div></body></html>"))
      .once('/timetables/1', s.createResponse("<html><body><div class=\"valid_from\">14.03.2011</div></body></html>"));

    waitsFor(function(){ return finished }, 'request', 1000);
    runs(function(){
      expect(callback).toHaveBeenCalled()
    })
  });

  it('should log requests of timetables which do not requre update', function(){
    var log, server;
    var pigeon = new Pigeons({ server: 'http://localhost:6000', get: { valid_from: 'div' }}, function(){
      var logs = s.createServer(6002, function(){
        pigeon.log = 'http://localhost:6002';
        server = s.createServer(6000, function(){
          pigeon.existing = {'http://localhost:6000/timetable/1': {valid_from: '25.03.2011'}}
          pigeon.getTimetable('/timetable/1');
        }).once('/timetable/1', s.createResponse(CreateDocument('<div>25.03.2011</div>')))
      }).once('/', function(req, resp){
        var buffer = '';
        req.on('data', function(chunk){ buffer += chunk });
        req.on('end', function(){
          resp.end();
          server.close();
          logs.close();
          log = JSON.parse(buffer);
        });
      });
    });
    waitsFor(function(){ return log }, 1000, 'log');
    runs(function(){
      expect(log.uri).toEqual('http://localhost:6000/timetable/1');
      expect(log.response_time.remote).toBeDefined();
      expect(log.creates).toBeUndefined();
      expect(log.updates).toBeUndefined();
    })
  });

  describe('errors', function(){

    it('should renew time out-ed request', function(){
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
