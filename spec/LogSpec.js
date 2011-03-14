describe('logger', function(){

  var db = 'http://localhost:5984/test_pigeons';
  var log = 'http://localhost:5984/test_logs';

  beforeEach(function(){
    var rm_db, rm_log;
    request({ method: 'DELETE', uri: db }, function(err){ rm_db = !err })
    request({ method: 'DELETE', uri: log }, function(err){ rm_log = !err })
    waitsFor(function(){return rm_db && rm_log }, 'clean', 500)
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
    var pigeons = new Pigeons({ server: 'http://httpstat.us',
                                     log: log,
                                     db: db});
    spyOn(pigeons, 'request').andCallThrough();
    pigeons.getTimetable('/200');

    waitsFor(function(){ return pigeons.request.argsForCall.length }, 'request', 1000);
    runs(function(){
      var log = pigeons.request.argsForCall[0][0].json
      expect(log.uri).toEqual('http://httpstat.us/200');
      expect(log.type).toEqual('Timetable');
    })
  });

  it('should depricate updated timetables', function(){
    var html = "<div class=\"valid_from\">14.03.2011</div>",
        pigeons = new Pigeons({ server: 'http://httpstat.us',
          log: log, 
          db: db,
          get: { valid_from: '.valid_from'}
        });
    spyOn(pigeons, 'parseTimetable').andReturn({ valid_from: '14.03.2011' });
    spyOn(pigeons, 'logger').andCallThrough();
    spyOn(pigeons, 'request').andCallThrough();

    request({ method: 'PUT', uri: 'http://localhost:5984/test_pigeons/foo', json: { valid_from: '13.03.2011' } })
    pigeons.existing = {'http://httpstat.us/200': { valid_from: '13.03.2011', id: 'foo' }};
    pigeons.getTimetable('/200');

    waitsFor(function(){ return pigeons.logger.argsForCall.length == 2 }, 'request', 1000);
    runs(function(){
      var timetable;
      var log = pigeons.request.argsForCall[pigeons.request.argsForCall.length-1][0].json
      expect(log.updates).toEqual('foo');

      request({ method: 'GET', uri: 'http://localhost:5984/test_pigeons/foo' }, function(err, resp, body){
        timetable = JSON.parse(body);
      });
      waitsFor(function(){ return timetable }, 'request', 1000);
      runs(function(){
        expect(timetable.valid_until).toEqual('14.03.2011');
      })
    })
  });

  it('should log old timetables removal', function(){
    var saved;
    var ready, pigeons = new Pigeons({ server: 'http://httpstat.us', home: '/200',
                                      log: log,
                                       db: db}, function(){
      request({ method: 'PUT', uri: 'http://localhost:5984/test_pigeons/foo',
                json: {type:'Timetable', uri:'http://httpstat.us/200'} }, function(err, resp, body){
        saved = !err; 
        pigeons.existing = {'http://httpstat.us/200': {id: 'foo', rev: JSON.parse(body).rev }}; 
      });
    });

    waitsFor(function(){ return saved }, 'save', 1000);
    runs(function(){
      pigeons.getAll(function(){ ready = true; });
    });
    spyOn(pigeons, 'logger');

    waitsFor(function(){ return ready }, 'getAll', 1000)
    runs(function(){
      var statusCode;
      request({ method: 'GET', uri: 'http://localhost:5984/test_pigeons/foo' }, function(err, resp, body){
        statusCode = resp.statusCode;
      });
      waitsFor(function(){ return statusCode }, 1000)
      runs(function(){
        var log = pigeons.logger.argsForCall[0][0];
        expect(statusCode).toEqual(404);
        expect(log.doc).toEqual('foo');
        expect(log.rev).toBeDefined();
      })
    });
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

    it('should log failed requests', function(){
      throw 'not implemented'
    });

    it('should log database errors', function(){
      throw 'not implemented'
    });

    it('should proceed despite errors', function(){
      throw 'not implemented'
    });
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
