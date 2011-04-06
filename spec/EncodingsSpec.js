describe('encoding', function(){
  var iconv = new Iconv('UTF-8', 'ISO-8859-2');
  var post, html = iconv.convert('<html><div class="day">Święta</div></html>');

  var source = s.createServer(6000, function(){ // Timetables source
    var db = s.createServer(6001, function(){ // Database
      (new Pigeons({
        encoding: 'ISO-8859-2', server: 'http://localhost:6000',
        get: {context: 'div', days: '.day', hours: '.hour', minutes: '.min'}}, function(){
          this.db = 'http://localhost:6001';
          this.getTimetable('/timetable/1');
        })
      )
    }).once('request', function(request, response){
      var r = '';
      request.on('data', function(chunk){ r += chunk });
      request.on('end', function(){
        response.writeHead(200, {'content-type':'text/plain'});
        response.write('OK');
        response.end();
        db.close();
        source.close();
        post = r.split('--frontier');
      });
    });
  }).once('/timetable/1', s.createResponse(html));

  beforeEach(function(){
    waitsFor(function(){ return post }, 500, 'response');
  })

  it('should save parsed timetables in utf8', function(){
    expect(post[1].match(/{.+}/)[0]).toContain('Święta');
  });

  it('should save source in the original encoding', function(){
    expect(post[2]).toContain(iconv.convert('Święta').toString())
  });
});
