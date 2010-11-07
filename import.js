var sys = require('sys')
    http = require('http'),
    request = require('request'),
    jsdom = require('jsdom'),
    couchdb = require('couchdb');

var Iconv  = require('iconv').Iconv;
var iconv = new Iconv('ISO-8859-2', 'UTF-8');

var client = couchdb.createClient(5984, 'localhost'),
    db = client.db('krapi-tmp');

var base_url = 'rozklady.mpk.krakow.pl',
    mpk = http.createClient(80, base_url);

var std = process.stdout;

// Skanuj stronę główną i zapisz linki linii
request({uri: 'http://'+base_url+'/linie.aspx'}, function(err, resp, body){
  var window = jsdom.jsdom(body).createWindow();
  jsdom.jQueryify(window, './jquery.js', function (window, $) {

    $('a[href$=htm]').each(function(i){

      var uri = $(this).attr('href').replace('rw', 'w0');
      setTimeout(function () {
      // sys.puts('http://'+base_url+'/'+line)
      // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
      request({uri: 'http://'+base_url+'/'+uri}, function(err, resp, body){

        std.write('.');
        var window = jsdom.jsdom(body).createWindow();
        jsdom.jQueryify(window, './jquery.js', function (window, $) {
          // Links to timetables
          $('a[href][target="R"]').each(function(j){
            var base = uri.split('/');
            uri = base.slice(0, base.length-1).join('/') +'/'+ $(this).attr('href')
            // timetables.push(uri)
            // sys.puts(uri)
      setTimeout(function () {
        std.write('*');
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
                jsdom.jQueryify(window, './jquery.js', function (window, $) {

                  var table = $('table[border=1]');
                  var doc = {},
                  re = /\d{2}.\d{2}.\d{4}/,
                  txt = $('table[border=1] tr:last-child b:first').text(), // TODO workaround
                  m = re.exec(txt);

                  doc['url'] = 'http://' + base_url + '/' + uri;
                  doc['line'] = $('table tr:first-child table tr:first-child td:first-child font').text();
                  doc['stop'] = $("table tr:first-child table tr:first-child td:first-child+td font:first-child").text();
                  doc['route'] = $("table tr:first-child table tr:first-child td:first-child+td font:not(:first-child)").text();
                  doc['valid_since'] = m ? m[0] : txt;
                  doc['updated_at'] = new Date();
                  doc['table'] = {};

                  $("table[border=1] tr:first-child font").each(function(i){ // TODO workaround
                    var key = $(this).text();
                    doc['table'][key] = {};
                    $('table[border=1] tr:not(:first-child, :last-child) td:nth-child('+ (i*2+1) +')').each(function(){
                      var self = $(this);
                      var minutes = self.next().text().split(" ");
                      minutes.shift();

                      if(minutes != ["-"])
                      doc['table'][key][self.text()] = minutes;
                    });
                  });

                  db.saveDoc(doc, function(er, ok) {
                    if (er) throw new Error(JSON.stringify(er));
                    // sys.puts(sys.inspect(ok))
                    std.write('!');
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
                      });
                    });
                  })
                })
              })
            })
      }, j*10)
          });

          // Links to oposite directions (lines)
          // Odwiedź wszystkie pozostałe liniie i zapisz linki do przystanków
          $("a[target='_parent']:not(:contains(*))").each(function(){
            var base = uri.split('/');
            uri = base.slice(0, base.length-1).join('/') +'/'+ $(this).attr('href').replace('rw', 'w0')

            request({uri: 'http://'+base_url+'/'+uri}, function(err, resp, body){
              // TODO: DRY
              std.write(':');
              var window = jsdom.jsdom(body).createWindow();
              jsdom.jQueryify(window, './jquery.js', function (window, $) {
                // Links to timetables
                $('a[href][target="R"]').each(function(){
                  var base = uri.split('/');
                  uri = base.slice(0, base.length-1).join('/') +'/'+ $(this).attr('href')
                  // timetables.push(uri)
                  // sys.puts(uri)
                })
              })
            })
          })
        })
      })
      }, i*200) // Sorry node, you're too fast :(
    })

    /*
    return;
    // Odwiedź wszystkie przystanki i zapisz je w bazie danych
    for(var i=0; i<timetables.length; i++){

// TODO: send request

              var table = $('table[border=1]');
              var doc = {},
                  re = /\d{2}.\d{2}.\d{4}/,
                  txt = $('table[border=1] tr:last-child b:first').text(), // TODO workaround
                  m = re.exec(txt);
              
              doc['url'] = 'http://' + base_url + '/' + agent.url;
              // doc['headers'] = 
              doc['line'] = $('table tr:first-child table tr:first-child td:first-child font').text();
              doc['stop'] = $("table tr:first-child table tr:first-child td:first-child+td font:first-child").text();
              doc['route'] = $("table tr:first-child table tr:first-child td:first-child+td font:not(:first-child)").text();
              doc['valid_since'] = m ? m[0] : txt;
              doc['updated_at'] = new Date();
              doc['table'] = {};
              
              $("table[border=1] tr:first-child font").each(function(i){ // TODO workaround
                var key = $(this).text();
                doc['table'][key] = {};
                $('table[border=1] tr:not(:first-child, :last-child) td:nth-child('+ (i*2+1) +')').each(function(){
                  var self = $(this);
                  var minutes = self.next().text().split(" ");
                  minutes.shift();
                  
                  if(minutes != ["-"])
                    doc['table'][key][self.text()] = minutes;
                });
              });
              
              db.saveDoc(doc, function(er, ok) {
                if (er) throw new Error(JSON.stringify(er));
                sys.puts(sys.inspect(ok))
                var id = ok.id
                var rev = ok.rev

                // Save headers
                db.request({
                  method: 'PUT',
                  path: '/'+ id +'/headers.json?rev='+rev,
                  headers: { 'Content-Type': 'application/json' },
                  data: agent.response.headers
                }, function(err,resp,body){
                  // Save source
                  db.request({
                    method: 'PUT',
                    path: '/'+ id +'/source.html?rev='+resp.rev,
                    headers: { 'Content-Type': 'text/html' },
                    data: agent.body
                  });
                });
              });
    }
    */
  })
})
