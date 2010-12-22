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

    var window = jsdom.jsdom(body, null, {url: root, features: {FetchExternalResources: false,ProcessExternalResources: false}}).createWindow(),
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
  var opts = this.opts;

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

      var d = -1, // indexes of: minutes, hours, days
          hours = []; // TODO remove
      var day;
      
      $(opts.context).forEach(function(el){
        if($.matchesSelector(el, opts.days)){
          doc['table'][el.textContent] = {};
        } else if($.matchesSelector(el, opts.hours)){
          var hour = parseInt(el.textContent);
          var days = Object.keys(doc['table']);
          
          // Check if timetable reads vertical or horizontal
          if(!hours.length || d >= days.length || hour <= hours[0] || hours[0] == hours[1])
            d += 1;

          day = days[d] || days[d%days.length];
        
          hours.unshift(hour);
          doc['table'][day][hour] = [];
        } else if($.matchesSelector(el, opts.minutes)){
          var minutes = el.textContent.split(" ");
          doc['table'][day][hours[0]] = 
            doc['table'][day][hours[0]].concat(minutes.filter(function(m){return m!=''})); // TODO: :not(:content(''))
        }
      });

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
