describe('scanner', function(){

  it('should follow links to lines', function(){
    var config = {db: 'http://httpstat.us/500', get: {lines: ".Line"}};
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

    waitsFor(function(){ return pigeons.get.mostRecentCall.args });
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
    var config = {get: {timetables: ".Timetable"}};
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
    pigeons.get.mostRecentCall.args[1](Sizzle(body), document, true);

    expect(pigeons.get).toHaveBeenCalled();
    expect(pigeons.put).toHaveBeenCalled();
    expect(pigeons.put.mostRecentCall.args[0].table).toEqual({"Dni słoneczne": {"12": ["00"]}});
    expect(pigeons.put.mostRecentCall.args[1]).toEqual(document);
  });
});
