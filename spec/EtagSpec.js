var Pigeons = require('pigeons').Client;

beforeEach(function(){
  var done;
  this.callback = jasmine.createSpy();
  this.pigeons = new Pigeons({db: 'http://localhost:5984/test_pigeons'}, function(){
    done = true;
  });
  spyOn(this.pigeons, 'get');
  spyOn(this.pigeons, 'parseTimetable').andReturn({});
  waitsFor(function(){return done})
});

describe('status code 302', function(){

  it('should be ack', function(){
    this.pigeons.getTimetable('/timetables/1', this.callback);
    this.pigeons.get.mostRecentCall.args[1]({statusCode: 302}, Sizzle(), "");

    expect(this.pigeons.parseTimetable).not.toHaveBeenCalled();
    expect(this.callback).toHaveBeenCalled()
  });
});

describe('status code 200', function(){

  it('should result in further page processing', function(){
    var html =  CreateDocument();
    this.pigeons.getTimetable('/timetables/1', this.callback);
    this.pigeons.get.mostRecentCall.args[1]({statusCode: 200}, Sizzle(html), html);

    expect(this.pigeons.parseTimetable).toHaveBeenCalled();
    //expect(this.callback).toHaveBeenCalled() todo: catch put request
  });
});
