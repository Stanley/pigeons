// Author: Stanisław Wasiutyński
// Date: 8.10.2010

var sys = require('sys')
    http = require('http'),
    request = require('request'),
    jsdom = require('jsdom'),
    couchdb = require('couchdb'),
    sizzle = require('./node-sizzle'),
    Iconv  = require('iconv').Iconv,
    String = require('nanotemplatejs').template(String)
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
  this.db.create()
}

Client.prototype.getAll = function(){

  var self = this;
  var opts = this.opts;
  var root = this.home.split('/').slice(0,-1).join('/') + '/'

  // Skanuj stronę główną i zapisz linki linii
  request({ uri: 'http://'+ this.base_url + this.home }, function(err, resp, body){
      var window = jsdom.jsdom(body, null, {url: root, features: {FetchExternalResources: false,ProcessExternalResources: false}}).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    var lines = $(opts.lines[0])
    var cb = function(){
      if(lines.length){
        var href = lines.shift().href.replace(/http:\/\/(\w.)+\//, '')
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

    var window = jsdom.jsdom(body, null, {url: root, features: {FetchExternalResources: false,ProcessExternalResources: false}}).createWindow(),
        $ = sizzle.loadSizzle(window.document);

    // Links to timetables
    var timetables = $(opts.timetables[0]) //$('a[href][target="R"]')
    var nextTimetable = function(){
      if(timetables.length){ // TODO timetables.shift().replace()
        var href = timetables.shift().href.replace(/http:\/\/(\w.)+\//, '')
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
        html += self.iconv ? self.iconv.convert(chunk) : chunk
      } catch(e){
        sys.puts(chunk);
        throw e
      }
    })

    response.on('end', function(){

      var window = jsdom.jsdom(html, null, {features: {FetchExternalResources: false,ProcessExternalResources: false}}).createWindow();
      var $ = sizzle.loadSizzle(window.document);
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
        var context = $(opts.context.t(i,i+1,2*i+1,2*i+2))

        doc['table'][key] = {};
        
        $.matches(opts.hours, context).
          map(function(hour){return hour.textContent}).
          sort().
          forEach(function(hour,j){
          var minutes = $.matches(opts.minutes.t(j, j+1), context).
                        map(function(min){return min.textContent.split(' ')}). // Some providers put all minutes in one node
                        reduce(function(sum,split){return sum.concat(split)}). // others don't
                        filter(function(min){return min != ''}); // Some folks just don't know how to make websites :(

          if(minutes.length && minutes != ['-']) // <- funny android face o_0
            doc['table'][key][hour] = minutes

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
