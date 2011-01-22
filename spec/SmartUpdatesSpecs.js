var Pigeons = require('pigeons').Client;

describe('local cache check', function(){

  this.pigeons = new Pigeons({ log: true });

  it('should retrieve all recent timetables', function(){
    var root = JSON.stringify({rows: [{id: '10', key: ['test', '2011-01-22'], value: 1}]});
    var timetables = JSON.stringify({ rows: [{id: '11', key: ['test'], value: {id: '11', valid_since: '21.01.2011'}}]});

    pigeons.getAll();

    pigeons.get.mostRecentCall.args[1](null, {}, root);
    pigeons.get.mostRecentCall.args[1](null, {}, timetables);

    expect(pigeons.existing).toEqual({'11': '21.01.2011'});
  });

  describe('valid_since', function(){

    beforeEach(function(){
      this.callback = jasmine.createSpy();
      
      spyOn(this.pigeons, 'get');
      spyOn(this.pigeons, 'put');
    });

    it('should result in timetable update when outdated', function(){
      var pigeons = this.pigeons;
      var callback = this.callback;
      var html = '<html></html>';

      pigeons.existing = {'1': {valid_since: '22.01.2011'}};
      pigeons.getTimetable('/timetables/1', callback);
      pigeons.get.mostRecentCall.args[1](null, {}, html);

      expect(pigeons.put).toHaveBeenCalledWith({table: {'Dni parzyste': {'12': '12'}}, 'valid_since': '22.01.2011'}, html);
      expect(callback).toHaveBeenCalled();
    });

    it('should not result in timetable update that was not changed on the server', function(){
      var pigeons = this.pigeons;
      var callback = this.callback;
      var html = '<html></html>';

      pigeons.existing = {'2': {valid_since: '01.01.2011'}};
      pigeons.getTimetable('/timetables/2', callback);
      pigeons.get.mostRecentCall.args[1](null, {}, html);

      expect(pigeons.put).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });
  });
});
