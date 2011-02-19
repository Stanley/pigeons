var Pigeons = require('pigeons').Client
  , request = require('request')

describe('local cache check', function(){

  var pigeons, ready;
  var uri = 'http://localhost:5984/test_logs';
  request({method: 'DELETE', uri: uri}, function(error){
    if(!error){
      pigeons = new Pigeons({
        log: uri, 
        db: 'http://localhost:5984/test_pigeons',
        get: { valid_from: '.valid_from'},
        server: 'mpk.krakow.pl'
      }, function(){
        ready = true
      });
    }
  });

  beforeEach(function(){
    waitsFor(function(){ return ready }, 'initialize pigeons', 200);
  })

  it('should retrieve all recent timetables', function(){

    var root, timetable;
    // Populate logs database
    request({
      method: 'POST', uri: uri,
      json: {type: 'Root', db: 'test', created_at: new Date()}
    }, function(error){ root = !error; });

    // Most recent timetable
    request({
      method: 'POST', uri: uri,
      json: {url: 'http://mpk.krakow.pl/timetables/1', type: 'Timetable', db: 'test_pigeons', valid_from: '21.01.2011', created_at: new Date()}
    }, function(error){ timetable = !error; });

    // TODO: Other, not relevant timetable

    waitsFor(function(){
      return root && timetable;
    }, 'saving logs', 200);

    runs(function(){
      var finished;
      var callback = jasmine.createSpy();
      spyOn(pigeons, 'get').andCallFake(function(){
        finished = true;
      });
      pigeons.getAll();

      waitsFor(function(){return finished}, 'logs', 200);
      runs(function(){
        expect(pigeons.existing).toEqual({'http://mpk.krakow.pl/timetables/1': '21.01.2011'});
      })
    });
  });

  describe('valid_from', function(){

    var callback = jasmine.createSpy();
    beforeEach(function(){
      spyOn(pigeons, 'get');
      spyOn(pigeons, 'put');
    });
    
    it('should result in timetable update when outdated', function(){
      var html = "<div class=\"valid_from\">28.01.2011</div>";

      pigeons.existing = {'http://mpk.krakow.pl/timetables/1': {valid_from: '22.01.2011'}};
      pigeons.getTimetable('/timetables/1', callback);
      pigeons.get.mostRecentCall.args[1]({ statusCode: 200 }, Sizzle(html), html);

      expect(pigeons.put).toHaveBeenCalledWith({
        valid_from: '28.01.2011',
        url: 'http://mpk.krakow.pl/timetables/1'
      }, html, callback);
    });

    it('should not result in timetable update that was not changed on the server', function(){
      var html = "<div class=\"valid_from\">28.01.2011</div>";

      pigeons.existing = {'http://mpk.krakow.pl/timetables/2': {valid_from: '28.01.2011'}};
      pigeons.getTimetable('/timetables/2', callback);
      pigeons.get.mostRecentCall.args[1]({ statusCode: 200 }, Sizzle(html), html);

      expect(pigeons.put).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });
  });
});
