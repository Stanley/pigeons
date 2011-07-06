describe('scanner', function(){

  var server, db, logs;
  beforeEach(function(){
    server = s.createServer(6000, function(){
      db = s.createServer(6001, function(){
        logs = s.createServer(6002, function(){});
      }).once('/_design/Timetable/_view/active', s.createResponse('{"rows":[]}'));
    });
    waitsFor(function(){return server && db && logs})
  });

  afterEach(function(){
    server.close(); db.close(); logs.close();
    server = db = logs = undefined;
  });

  it('should follow links to lines', function(){
    var config = {db: 'http://localhost:6001', get: {lines: ".Line"}};
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/lines/1\" class=\"Line\">1</a>" +
               "<a href=\"/lines/2\" class=\"Line\">2</a>" +
               "<a href=\"/lines/3\" class=\"Line\">3</a>";

    spyOn(pigeons, 'get');
    spyOn(pigeons, 'getLine').andCallFake(function(){
      pigeons.getLine.mostRecentCall.args[1]();
    });

    var callback = jasmine.createSpy();
    pigeons.getAll(callback);

    waitsFor(function(){ return pigeons.get.mostRecentCall.args }, 1000);
    runs(function(){
      pigeons.get.mostRecentCall.args[1](Sizzle(body));

      expect(callback).toHaveBeenCalled();
      expect(pigeons.get).toHaveBeenCalled();
      expect(pigeons.getLine.callCount).toEqual(3);

      expect(pigeons.getLine.argsForCall[0][0]).toEqual('/lines/1');
      expect(pigeons.getLine.argsForCall[1][0]).toEqual('/lines/2');
      expect(pigeons.getLine.argsForCall[2][0]).toEqual('/lines/3');
    })
  });

  it('should follow links to opposite lines', function(){
  });

  it('should follow links to timetables', function(){
    var config = {get: {timetables: '.Timetable'}};
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/timetables/1\" class=\"Timetable\">1</a>" +
               "<a href=\"/timetables/2\" class=\"Timetable\">2</a>" +
               "<a href=\"/timetables/3\" class=\"Timetable\">3</a>";

    spyOn(pigeons, 'get');
    spyOn(pigeons, 'getTimetable').andCallFake(function(){
      pigeons.getTimetable.mostRecentCall.args[1]();
    });

    var callback = jasmine.createSpy();
    pigeons.getLine('/lines/1', callback);
    pigeons.get.mostRecentCall.args[1](Sizzle(body));

    expect(callback).toHaveBeenCalled();
    expect(pigeons.get.callCount).toEqual(1);
    expect(pigeons.getTimetable.callCount).toEqual(3);

    expect(pigeons.getTimetable.argsForCall[0][0]).toEqual('/timetables/1');
    expect(pigeons.getTimetable.argsForCall[1][0]).toEqual('/timetables/2');
    expect(pigeons.getTimetable.argsForCall[2][0]).toEqual('/timetables/3');
  });

  it('should replace parts of links to lines if required', function(){
    var request;
    var config = {
      server: 'http://localhost:6000', home: '/',
      get: {lines: ['.Line', ['foo', 'bar']] }};
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/foo/A\" class=\"Line\">A</a>";

    server.once('/', function(req, resp){
      server.once('request', function(req){ request = req })
      return s.createResponse(CreateDocument(body))(req, resp)
    });

    pigeons.getAll();

    waitsFor(function(){ return request }, 1000);
    runs(function(){
      expect(request.url).toEqual('/bar/A');
    })
  });

  it('should replace parts of links to timetables if required', function(){
    var config = {get: {timetables: ['.Timetable', ['foo', 'bar']] }};
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/foo/1\" class=\"Timetable\">1</a>";

    spyOn(pigeons, 'get');
    spyOn(pigeons, 'getTimetable').andCallFake(function(){
      pigeons.getTimetable.mostRecentCall.args[1]();
    });

    pigeons.getLine('/lines/2', function(){});
    pigeons.get.mostRecentCall.args[1](Sizzle(body));

    expect(pigeons.getTimetable.argsForCall[0][0]).toEqual('/bar/1');
  });

  it('should scan opposite line if specified', function(){
    var config = {db: 'http://localhost:6001', get: {opposite: '.Opposite', timetables: '.Timetable'}}
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/lines/B\" class=\"Opposite\">B</a>";

    spyOn(pigeons, 'get');
    pigeons.getLine('/lines/3', function(){});
    pigeons.get.mostRecentCall.args[1](Sizzle(body));

    expect(pigeons.get.mostRecentCall.args[0]).toEqual('/lines/B');
  });

  it('should replace links to opposite lines the same way links to lines are', function(){
    var config = {db: 'http://localhost:6001', 
                  get: {lines: ['.Line', ['foo', 'bar']], opposite: '.Opposite', timetables: '.Timetable'}}
    var pigeons = new Pigeons(config);
    var body = "<a href=\"/foo/C\" class=\"Opposite\">B</a>";

    spyOn(pigeons, 'get');
    pigeons.getLine('/lines/4', function(){});
    pigeons.get.mostRecentCall.args[1](Sizzle(body));

    expect(pigeons.get.mostRecentCall.args[0]).toEqual('/bar/C');
  });
});

describe('database adapter', function(){

  it('should recieve parsed timetable and its source', function(){
    var config = { get: { context: 'div', days: '.day', hours: '.hour', minutes: '.minute' }};
    var pigeons = new Pigeons(config);
    var body = "<div class=\"day\">Dni słoneczne</div><div class=\"hour\">12</div><div class=\"minute\">00</div>";
    var document = CreateDocument(body);

    spyOn(pigeons, 'get');
    spyOn(pigeons, 'put');

    pigeons.getTimetable('/timetables/1')
    pigeons.get.mostRecentCall.args[1](Sizzle(body), undefined, document, true);

    expect(pigeons.get).toHaveBeenCalled();
    expect(pigeons.put).toHaveBeenCalled();
    expect(pigeons.put.mostRecentCall.args[0].table).toEqual({"Dni słoneczne": {"12": ["00"]}});
    expect(pigeons.put.mostRecentCall.args[1]).toEqual(document);
  });
});
