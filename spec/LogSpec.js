describe('logger', function(){

  var db = 'http://localhost:5984/test_pigeons';

  beforeEach(function(){
    var removed;
    request({ method: 'DELETE', uri: db }, function(){ removed = true });
    waitsFor(function(){return removed }, 'clean', 500);
  });

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
          this.db = 'http://localhost:6001';
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
    var deprecated, logged = [], doc = { type: 'Timetable', valid_from: '13.03.2011', url: 'http://localhost:6000/timetables/1' };
    var server = s.createServer(6000, function(){
      pigeons = new Pigeons({ server: 'http://localhost:6000', home: '/', db: db},
        function(){
          var logs = s.createServer(6003, function(){
            pigeons.log = 'http://localhost:6003';
            request({ method: 'PUT', uri: db +'/foo', json: doc }, // create old timetable
              function(){
                pigeons.getAll(function(){ // should get all old timetables
                  request({ uri: db +'/foo' }, function(err, resp, body){
                    server.close();
                    logs.close();
                    deprecated = JSON.parse(body);
                  });
                });
              }
            );
          }).on('request', function(req, resp){
            var buffer = '';
            req.on('data', function(chunk){ buffer += chunk });
            req.on('end', function(){
              logged.push(JSON.parse(buffer));
            });
          });
        }
      );
    }).once('/', s.createResponse("<div>Witaj!</div>"))

    waitsFor(function(){ return deprecated }, 'request', 2000);
    runs(function(){
      var d = new Date(), month = d.getMonth()+1;
      var today = d.getDate() +'.'+ (month > 9 ? month : '0'+month) +'.'+ d.getFullYear();
      expect(deprecated.valid_until).toEqual(today);

      var log = logged[logged.length-1];
      expect(log.type).toEqual('Deprication');
      expect(log.urls).toEqual([ 'http://localhost:6000/timetables/1' ]);
    })
  });
  
  it('should deprecate outdated timetables (newer avaliable)', function(){
    var deprecated, doc = { type: 'Timetable', valid_from: '13.03.2011', url: 'http://localhost:6000/timetables/1' };
    var server = s.createServer(6000, function(){
      pigeons = new Pigeons({ server: 'http://localhost:6000', home: '/',
        db: db,
        get: { lines: 'a', timetables: 'a', valid_from: '.valid_from' } },
        function(){
          request({ method: 'PUT', uri: db +'/foo', json: doc }, // create old timetable
            function(){
              pigeons.getAll(function(){ // should get all old timetables
                request({ uri: db +'/foo' }, function(err, resp, body){
                  server.close();
                  deprecated = JSON.parse(body);
                })
              })
            }
          );
        }
      );
    }).once('/', s.createResponse("<html><body><div><a href=\"/lines/1\">1</a></div></body></html>"))
      .once('/lines/1', s.createResponse("<html><body><div><a href=\"/timetables/1\">1</a></div></body></html>"))
      .once('/timetables/1', s.createResponse("<html><body><div class=\"valid_from\">14.03.2011</div></body></html>"));

    waitsFor(function(){ return deprecated }, 'request', 1000);
    runs(function(){
      expect(deprecated.valid_until).toEqual('14.03.2011');
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
        }).once('/timetable/1', s.createResponse('<html><body><div>25.03.2011</div></body></html>'))
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
