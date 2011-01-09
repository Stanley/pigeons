// Author: Stanisław Wasiutyński
// Date: 8.10.2010

var sys = require('sys')
    http = require('http'),
    request = require('request'),
    jsdom = require('jsdom'),
    couchdb = require('couchdb'), // felixge/node-couchdb
    sizzle = require('./node-sizzle'),
    Iconv  = require('iconv').Iconv,
    std = process.stdout;

var Client = exports.Client = function(options){
  this.db = couchdb.createClient(5984, 'localhost').db(options.code);
  this.base_url = options.server;
  this.root = options.home.split('/').slice(0,-1).join('/') + '/'
  this.home = options.home;
  this.mpk = http.createClient(80, this.base_url);
  this.opts = options.get;

  // No need to convert utf8 pages
  if(options.encoding) this.iconv = new Iconv(options.encoding, 'UTF-8');

  // Creates db if doesn't exist
  this.db.remove()
  this.db.create()
}

Client.defaults = function(root){
  return {url: root, features: {FetchExternalResources: false, ProcessExternalResources: false}};
};

Client.prototype.getAll = function(){

  var self = this;
  var opts = this.opts;
  var root = this.home.split('/').slice(0,-1).join('/') + '/'

  // Skanuj stronę główną i zapisz linki linii
  request({ uri: 'http://'+ this.base_url + this.home }, function(err, resp, body){
    var window = jsdom.jsdom(body, null, Client.defaults(root)).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    var lines = $(opts.lines[0])
    var cb = function(){
      if(lines.length){
        var href = lines.shift().href.replace(/http:\/\/[\w.]+\//, '')
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

    var window = jsdom.jsdom(body, null, Client.defaults(root)).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    // Links to timetables
    var timetables = $(opts.timetables[0])
    var nextTimetable = function(){
      if(timetables.length){ // TODO timetables.shift().replace()
        var href = timetables.shift().href.replace(/http:\/\/[\w.]+\//, '')
        //href = href.replace.apply(href, opts.timetables[1])
        if(opts.timetables[1])
          href = href.replace(RegExp(opts.timetables[1][0]), opts.timetables[1][1])
        self.getTimetable(uri, href, nextTimetable)
      } else
        cb()
    }
    nextTimetable()

    // It will query opposite line simultaneously
    if(is_first && opts.opposite){
      // Links to opposite directions (lines)
      // Odwiedź wszystkie pozostałe liniie i zapisz linki do przystanków
      var lines = $(opts.opposite)
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
  //cb = function(){
  //  throw "debugger mode on"
  //}

  var self = this;

  if(link.slice(0,7) == 'http://'){
    url = link.slice(7) // TODO slice server ?
      throw "?"
  } else {
    var base = uri.split('/');
    url = link; 
  }

  std.write('*'); // Request timetable
  var timetable = this.mpk.request('GET', url, { host: this.base_url })
  timetable.end()
  timetable.on('response', function(response){
    var html = ''
    response.on('data', function(chunk){
      html += self.iconv ? self.iconv.convert(chunk) : chunk
    })

    response.on('end', function(){

      var window = jsdom.jsdom(html, null, Client.defaults()).createWindow();
      var doc = self.parseTimetable(window);
          doc.url = "http://" + self.base_url + url;

      // Debugging
      // sys.puts(sys.inspect(doc))

      self.db.saveDoc(doc, function(er, ok) {
        if (er) throw new Error(JSON.stringify(er));
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

Client.prototype.parseTimetable = function(window) {
  var self = this;
  var opts = self.opts;
  var $ = sizzle.loadSizzle(window.document);
  var doc = {},
      re = RegExp(opts.expiration[1]),
      txt = $.getText($(opts.expiration[0])), // TODO workaround
      m = re.exec(txt);

  doc['line'] = $.getText($(opts.line_no)).trim();
  doc['stop'] = $.getText($(opts.stop_name)).trim();

  if(opts.route)
    doc['route'] = $.getText($(opts.route));
  else if(opts.destination)
    doc['destination'] = $.getText($(opts.destination));

  doc['valid_since'] = m ? m[0] : txt;
  doc['updated_at'] = new Date();
  doc['table'] = {};

  var d = -1, // indexes of: minutes, hours, days
      day, hour, hours = [];

  $(opts.context).forEach(function(el){
    if($.matchesSelector(el, opts.days)){
      doc['table'][el.textContent] = {};
      d += 1;
    } else if($.matchesSelector(el, opts.hours)){
      var days = Object.keys(doc['table']);
      var h = parseInt(el.textContent);

      // Check if timetable reads vertical or horizontal
      if(d >= days.length || 
        (h == hour && h != 0) ||
        days.length > 1 && hour == undefined)
        d += 1;

      day = days[d] || days[d%days.length];

      hours.unshift(h);
    } else if($.matchesSelector(el, opts.minutes)){
      if(hours.length)
        hour = hours.pop();

      var minutes = (el.children.length > 1 ?
            Array.prototype.slice.call(el.children).map(function(e){return e.textContent}) :
            el.textContent.split(/\s+/)
          ).filter(function(m){return m!='' && m!='-'});
      var result = (doc['table'][day][hour] || []).concat(minutes);

      if(result.length){
        if(!doc['table'][day][hour])
          doc['table'][day][hour] = [];
        doc['table'][day][hour] = result;
      }
    }
  });

  return doc;
}
