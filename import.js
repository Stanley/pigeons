// Author: Stanisław Wasiutyński
// Date: 8.10.2010

var sys = require('sys')
    http = require('http'),
    request = require('request'),
    jsdom = require('jsdom'),
    couchdb = require('couchdb'),
    sizzle = require('./node-sizzle'),
    Iconv  = require('iconv').Iconv,
    iconv = new Iconv('ISO-8859-2', 'UTF-8'),
    std = process.stdout;

var db = couchdb.createClient(5984, 'localhost').db('krapi-tmp'),
    base_url = 'rozklady.mpk.krakow.pl',
    mpk = http.createClient(80, base_url);

var getTimetable = function(uri, link, cb) {

  std.write('*'); // Request timetable
  var base = uri.split('/');
  uri = base.slice(0, base.length-1).join('/') +'/'+ link.href;
  var mpk = http.createClient(80, base_url);
  var timetable = mpk.request('GET', '/'+uri, { host: base_url })
  timetable.end()
  timetable.on('response', function(response){
    var html = ''
    response.on('data', function(chunk){
      html += iconv.convert(chunk)
    })

    response.on('end', function(){
      var window = jsdom.jsdom(html).createWindow();
      var $ = sizzle.loadSizzle(window.document);
      var doc = {},
          re = /\d{2}.\d{2}.\d{4}/,
          txt = $.getText($('table[border=1] tr:last-child b:first')), // TODO workaround
          m = re.exec(txt);

      doc['url'] = 'http://' + base_url + '/' + uri;
      doc['line'] = $.getText($('table tr:first-child table tr:first-child td:first-child font'));
      doc['stop'] = $.getText($("table tr:first-child table tr:first-child td:first-child+td font:first-child"));
      doc['route'] = $.getText($("table tr:first-child table tr:first-child td:first-child+td font:not(:first-child)"));
      doc['valid_since'] = m ? m[0] : txt;
      doc['updated_at'] = new Date();
      doc['table'] = {};

      $("table[border=1] tr:first-child font").forEach(function(day,i){ // TODO workaround
        var key = day.innerHTML;
        doc['table'][key] = {};
        $('table[border=1] tr:not(:first-child, :last-child) td:nth-child('+ (i*2+1) +')').forEach(function(hour){
          var minutes = hour.nextSibling.innerHTML.split(' ');
          minutes.shift(); // last element is always empty *cough*

          if(minutes != ["-"]) // <- funny android face o_0
          doc['table'][key][$.getText([hour])] = minutes
        });
      });

      db.saveDoc(doc, function(er, ok) {
        if (er) throw new Error(JSON.stringify(er));
        // sys.puts(sys.inspect(ok))
        std.write('!'); // Document saved
        var id = ok.id;
        var rev = ok.rev;

        // Save headers
        db.request({
          method: 'PUT',
          path: '/'+ id +'/headers.json?rev='+rev,
          headers: { 'Content-Type': 'application/json' },
          data: response.headers
        }, function(err,resp,body){
          // Save source
          db.request({
            method: 'PUT',
            path: '/'+ id +'/source.html?rev='+resp.rev,
            headers: { 'Content-Type': 'text/html' },
            data: html.replace(/iso-8859-2/g, 'utf-8')
          }, cb);
        });
      })
    })
  })
}

var getLines = function(link, cb, first){

    var uri = link.replace('rw', 'w0');
    // sys.puts('http://'+base_url+'/'+line)
    // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
    std.write('.'); // Request line
    request({uri: 'http://'+base_url+'/'+uri}, function(err, resp, body){

      var window = jsdom.jsdom(body).createWindow();
      var $ = sizzle.loadSizzle(window.document);

      // Links to timetables
      var timetables = $('a[href][target="R"]')
      var nextTimetable = function(){
        if(timetables[0])
          getTimetable(uri, timetables.shift(), nextTimetable)
        else
          cb()
      }
      nextTimetable()

      // It will query opposite line simultaneously
      if(first){
        // Links to opposite directions (lines)
        // Odwiedź wszystkie pozostałe liniie i zapisz linki do przystanków
        var lines = $('a[target="_parent"]:not(:contains(*))') //.each(function(){
        var base = uri.split('/');
        var nextLine = function(){
          if(lines[0])
            getLines(base.slice(0, base.length-1).join('/') +'/'+ lines.shift().href, nextLine)
        }
        nextLine()
      }
          
    })
}

// Skanuj stronę główną i zapisz linki linii
request({uri: 'http://'+base_url+'/linie.aspx'}, function(err, resp, body){
  var window = jsdom.jsdom(body).createWindow();
  var $ = sizzle.loadSizzle(window.document);

  var lines = $('a[href$=htm]')
  var cb = function(){
    if(lines[0])
      getLines(lines.shift().href, cb, true)
  }
  cb()
})
