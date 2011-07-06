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
    this.pigeons.get.mostRecentCall.args[1](undefined, {statusCode: 302}, "");

    expect(this.pigeons.parseTimetable).not.toHaveBeenCalled();
    expect(this.callback).toHaveBeenCalled()
  });
});

describe('status code 200', function(){

  it('should result in further page processing', function(){
    var html =  CreateDocument();
    this.pigeons.getTimetable('/timetables/1', this.callback);
    this.pigeons.get.mostRecentCall.args[1](Sizzle(html), undefined, html, true);

    expect(this.pigeons.parseTimetable).toHaveBeenCalled();
    //expect(this.callback).toHaveBeenCalled() todo: catch put request
  });
});

describe('ETag', function(){

  it('should be send to remote server', function(){
    var headers;
    var server = s.createServer(6000, function(){
      new Pigeons({}, function(){
        this.server = 'http://localhost:6000';
        this.existing = {'http://localhost:6000/timetables/1': {etag: 'foo'}};
        this.get('/timetables/1');
      });
    }).once('/timetables/1', function(req, resp){
      resp.writeHead(200, {});
      resp.write('OK');
      resp.end();
      server.close();
      headers = req.headers;
    });

    waitsFor(function(){ return headers }, 'headers', 1000);
    runs(function(){
      expect(headers['if-none-match']).toEqual('foo');
    });
  });
});
