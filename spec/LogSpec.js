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
    })
  });

  it('should deprecate not existing timetables', function(){
    var deprecated, doc = { type: 'Timetable', valid_from: '13.03.2011', url: 'http://localhost:6000/timetables/1' };
    var server = s.createServer(6000, function(){
      pigeons = new Pigeons({ server: 'http://localhost:6000', home: '/', db: db},
        function(){
          request({ method: 'PUT', uri: db +'/foo', json: doc }, // create old timetable
            function(){
              pigeons.getAll(function(){ // should get all old timetables
                request({ uri: db +'/foo' }, function(err, resp, body){
                  server.close();
                  deprecated = JSON.parse(body);
                });
              });
            }
          );
        }
      );
    }).once('/', s.createResponse("<div>Witaj!</div>"))

    waitsFor(function(){ return deprecated }, 'request', 1000);
    runs(function(){
      var d = new Date(), month = d.getMonth()+1;
      var today = d.getDate() +'.'+ (month > 9 ? month : '0'+month) +'.'+ d.getFullYear();
      expect(deprecated.valid_until).toEqual(today);
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

  describe('errors', function(){

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
