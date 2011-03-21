var Pigeons = require('pigeons').Client
  , request = require('request')

describe('local cache check', function(){

  var pigeons, ready;
  var uri = 'http://localhost:5984/test_logs';
  var db =  'http://localhost:5984/test_pigeons';
  request({method: 'DELETE', uri: uri}, function(error){
    if(!error){
      pigeons = new Pigeons({
        log: uri, 
        db: db,
        get: { valid_from: '.valid_from'},
        server: 'http://mpk.krakow.pl'
      }, function(){
        ready = true
      });
    }
  });

  beforeEach(function(){
    waitsFor(function(){ return ready }, 'initialize pigeons', 200);
  })

  it('should retrieve all recent timetables', function(){

    var timetable;
    request({ method: 'POST', uri: db,
              json: {type: 'Timetable', url: 'http://mpk.krakow.pl/timetables/1', valid_from: '21.01.2011' }}, function(){
      timetable = true;
    });

    waitsFor(function(){
      return timetable;
    }, 'history', 200);

    runs(function(){
      var finished;
      var callback = jasmine.createSpy();
      spyOn(pigeons, 'get').andCallFake(function(){
        finished = true;
      });
      pigeons.getAll();

      waitsFor(function(){return finished}, 'logs', 200);
      runs(function(){
        expect(pigeons.existing['http://mpk.krakow.pl/timetables/1']).toBeDefined();
        expect(pigeons.existing['http://mpk.krakow.pl/timetables/1'].valid_from).toEqual('21.01.2011')
      })
    });
  });

  describe('valid_from', function(){

    beforeEach(function(){
      spyOn(pigeons, 'get');
      spyOn(pigeons, 'put');
    });
    
    it('should result in timetable update when outdated', function(){
      var html = "<div class=\"valid_from\">28.01.2011</div>";

      pigeons.existing = {'http://mpk.krakow.pl/timetables/1': {valid_from: '22.01.2011'}};
      pigeons.getTimetable('/timetables/1');
      pigeons.get.mostRecentCall.args[1](Sizzle(html), html, true);

      expect(pigeons.put.mostRecentCall.args[0]).toEqual({
        valid_from: '28.01.2011',
        url: 'http://mpk.krakow.pl/timetables/1'
      });
      expect(pigeons.put.mostRecentCall.args[1]).toEqual(html);
      // TODO
      // expect(callback).toHaveBeenCalled();
    });

    it('should not result in timetable update that was not changed on the server', function(){
      var callback = jasmine.createSpy();
      var html = "<div class=\"valid_from\">28.01.2011</div>";

      pigeons.existing = {'http://mpk.krakow.pl/timetables/2': {valid_from: '28.01.2011'}};
      pigeons.getTimetable('/timetables/2', callback);
      pigeons.get.mostRecentCall.args[1](Sizzle(html), html, true);

      expect(pigeons.put).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });
  });
});
