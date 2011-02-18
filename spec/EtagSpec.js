var Pigeons = require('pigeons').Client;

beforeEach(function(){
  this.pigeons = new Pigeons({});
  this.callback = jasmine.createSpy();
  
  spyOn(this.pigeons, 'get');
  spyOn(this.pigeons, 'parseTimetable');
});

describe('status code 302', function(){

  it('should be ack', function(){
    this.pigeons.getTimetable('/timetables/1');
    this.pigeons.get.mostRecentCall.args[1](null, {statusCode: 302}, "");

    expect(this.pigeons, 'parseTimetable').not.toHaveBeenCalled();
    expect(this.callback).toHaveBeenCalled()
  });
});

describe('status code 200', function(){

  it('should result in further page processing', function(){
    this.pigeons.getTimetable('/timetables/1');
    this.pigeons.get.mostRecentCall.args[1](null, {statusCode: 200}, "<html></html>");

    expect(this.pigeons, 'parseTimetable').toHaveBeenCalled();
    expect(this.callback).toHaveBeenCalled();
  });
});
