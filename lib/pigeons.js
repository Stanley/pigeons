// Author: Stanisław Wasiutyński
// Date: 8.10.2010

var sys = require('sys')
    http = require('http'),
    request = require('request'),
    jsdom = require('jsdom'),
    couchdb = require('couchdb'),
    sizzle = require('./node-sizzle'),
    Iconv  = require('iconv').Iconv,
    sprintf = require('sprintf').sprintf,
    std = process.stdout;

var Client = exports.Client = function(options){
  this.db = couchdb.createClient(5984, 'localhost').db(options.code);
  this.base_url = options.server;
  this.root = options.home.split('/').slice(0,-1).join('/') + '/'
  this.home = options.home;
  this.mpk = http.createClient(80, this.base_url);
  this.opts = options.get;
  this.iconv = new Iconv(options.encoding, 'UTF-8');
}

Client.prototype.getAll = function(){

  var self = this;
  var opts = this.opts;

  // Skanuj stronę główną i zapisz linki linii
  request({ uri: 'http://'+ this.base_url + this.home }, function(err, resp, body){
    var window = jsdom.jsdom(body, null, {url: self.root}).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    var lines = $(opts.lines[0]) //$('a[href$=htm]')
    var cb = function(){
      if(lines.length){
        var href = lines.shift().href
        href = href.replace.apply(href, opts.lines[1])
        self.getLines(href, cb, true)
      }
    }
    cb()
  })
}

Client.prototype.getLines = function(uri, cb, is_first){

  var self = this;
  var opts = this.opts;
  var url;

  if(uri.slice(0,7) == 'http://')
    url = uri.slice(7);
  else
    url = uri 

  var root = url.split('/').slice(0,-1).join('/') + '/'

  // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
  std.write('.'); // Request line
  request({ uri: "http://" + self.base_url + url}, function(err, resp, body){

    var window = jsdom.jsdom(body, null, {url: root}).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    // Links to timetables
    var timetables = $(opts.timetables[0]) //$('a[href][target="R"]')
    var nextTimetable = function(){
      if(timetables.length){ // TODO timetables.shift().replace()
        var href = timetables.shift().href
        href = href.replace.apply(href, opts.timetables[1])
        self.getTimetable(uri, href, nextTimetable)
      } else
        cb()
    }
    nextTimetable()

    // It will query opposite line simultaneously
    if(is_first && opts.opposite){
      // Links to opposite directions (lines)
      // Odwiedź wszystkie pozostałe liniie i zapisz linki do przystanków
      var lines = $(opts.opposite) //$('a[target="_parent"]:not(:contains(*))') //.each(function(){
      var base = uri.split('/');
      var nextLine = function(){
        if(lines[0])
          self.getLines(base.slice(0, base.length-1).join('/') +'/'+ lines.shift().href, nextLine)
      }
      nextLine()
    }
  })
}

Client.prototype.getTimetable = function(uri, link, cb) {

  // Debugging
  cb = function(){
    throw "debugger mode on"
  }

  var self = this;
  var opts = this.opts;

  if(link.slice(0,7) == 'http://'){
    url = link.slice(7) // TODO slice server ?
  } else {
    var base = uri.split('/');
    url = link; 
  }

  std.write('*'); // Request timetable
  // var mpk = http.createClient(80, base_url);
  var timetable = this.mpk.request('GET', url, { host: this.base_url })
  timetable.end()
  timetable.on('response', function(response){
    var html = ''
    response.on('data', function(chunk){
      try{
        html += self.iconv.convert(chunk)
      } catch(e){
        sys.puts(chunk);
        throw e
      }
    })

    response.on('end', function(){

      var window = jsdom.jsdom(html).createWindow();
      var $ = sizzle.loadSizzle(window.document);
      var j = 0;
      var doc = {},
          re = RegExp(opts.expiration[1]),
          txt = $.getText($(opts.expiration[0])), // TODO workaround
          m = re.exec(txt);

      doc['url'] = "http://" + self.base_url + url;
      doc['line'] = $.getText($(opts.line_no));
      doc['stop'] = $.getText($(opts.stop_name));

      if(opts.route)
        doc['route'] = $.getText($(opts.route));
      else if(opts.destination)
        doc['destination'] = $.getText($(opts.destination));
                              
      doc['valid_since'] = m ? m[0] : txt;
      doc['updated_at'] = new Date();
      doc['table'] = {};

      $(opts.labels).forEach(function(day,i){ // TODO workaround
        var key = day.innerHTML; //$.getText(day);

        doc['table'][key] = {};
        $(sprintf(opts.hours, i, i+1)).forEach(function(hour){
          var minutes = $(sprintf(opts.minutes, j, j+1)).
                        map(function(min){return min.textContent});

          if(minutes != ["-"]) // <- funny android face o_0
            doc['table'][key][$.getText([hour])] = minutes

          j += 1;
        });
      });

      // Debugging
      // sys.puts(sys.inspect(doc))

      self.db.saveDoc(doc, function(er, ok) {
        if (er) throw new Error(JSON.stringify(er));
        // sys.puts(sys.inspect(ok))
        std.write('!'); // Document saved
        var id = ok.id;
        var rev = ok.rev;

        // Save headers
        self.db.request({
          method: 'PUT',
          path: '/'+ id +'/headers.json?rev='+rev,
          headers: { 'Content-Type': 'application/json' },
          data: response.headers
        }, function(err,resp,body){
          // Save source
          self.db.request({
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
