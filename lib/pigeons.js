var sys = require('sys')
  , fs = require('fs')
  , request = require('request')
  , Sizzle = require('./node-sizzle').Sizzle
  , Jsdom = require('jsdom')
  , couchapp = require('couchapp')
  , Iconv  = require('iconv').Iconv
  , hashlib = require('hashlib')
  , url = require('url')
  , stream = require('stream')
  , buffertools = require('buffertools')
  , async = require('async')
  , http = require('http')
  ;

var sizzle = new Sizzle();

var Client = exports.Client = function(options, callback){

  var self = this;
  self.server = options.server;
  self.home = options.home;
  self.opts = options.get;
  self.db = options.db;
  self.request = request; // For tests TODO: get rid of this
  self.existing = {}; // Poor's man cache
  self.outdated = []; // List of urls to timetables which have been replaced with newer versions

  // No need to convert utf8 pages
  if(options.encoding) self.iconv = new Iconv(options.encoding, 'UTF-8');

  if(options.log) {
    self.log = options.log;
    Client.createCouchApp(self.log, function(){ callback(self) });
  } else { if(callback) callback.call(self) }
}

Client.createCouchApp = function(db, cb){
  couchapp.createApp(require(__dirname +'/../couch/app.js'), db, function(app){
    app.push(cb) 
  });
}

Client.prototype.logger = function(doc, callback){
  if(this.log){
    doc.created_at = new Date();

    if(doc.response_time){
      if(typeof doc.response_time.db == 'object')
        doc.response_time.db = new Date() - doc.response_time.db;
      if(typeof doc.response_time.remote == 'object')
        doc.response_time.remote = new Date() - doc.response_time.remote;
    }
    
    if(callback && doc.type == 'Timetable') callback(doc)
    if(!callback || doc.type != 'Timetable') {
      this.request({
        method: 'POST',
        uri: this.log,
        json: doc
      }, callback);
    }
  } else if(callback) callback();
}

Client.prototype.get = function(path, callback, type){
  var self = this
    , now = new Date()
    , body = new Buffer('')
    , uri = url.resolve(self.server,path)
    , etag = (self.existing[uri] || {}).etag
    , response
    ;

  var parsed = url.parse(uri);
  var options = {
    port: parsed.port,
    host: parsed.hostname,
    path: parsed.pathname + (parsed.search || ''),
    headers: {'if-none-match':etag}
  };

  var req = http.request(options, function(response) {
    response.on('data', function (chunk) {
      body = buffertools.concat(body, chunk) 
    });
    response.on('end', function(){
      var $;
      var log = {
        uri: uri,
        type: type,
        headers: response.headers,
        statusCode: response.statusCode,
        response_time: { remote: now }};

      if(response.statusCode == 200){
        body = self.iconv ? self.iconv.convert(body) : body;
        var root = url.parse(uri).pathname.match(/^.*\//)[0]; // todo specs
        var opts = {url: root, features: {FetchExternalResources: false, ProcessExternalResources: false}};
        var dom = Jsdom.jsdom(body.toString().replace(/(<\/html>)[\s\S]*/i, '$1'), null, opts).createWindow();
        $ = sizzle.run(dom.document);
      }

      self.logger(log, function(doc){
        if(callback) callback($, doc || log, body);
      });
    })
  });

  req.on('error', function(e) {
    throw e.message
      //console.log('problem with request: ' + e.message);
  });

  req.end();
};

Client.prototype.put = function(doc, html, callback){
  if(!this.db) return;
  // Let id be a SHA1 hash, based on source and valid_from date (or table if valid_from in not provided).
  // This will result in 409 Conflict when the same timetable is being pushed to the database.
  var headers = { 'Content-Type': 'multipart/related;boundary="frontier"' };
  var self = this;

  // For testing you can force document id
  doc._id = doc._id || hashlib.sha1([doc.source, doc.valid_from || doc.table]);
  doc.type = 'Timetable';
  doc.created_at = new Date();
  doc._attachments = {
    'source.html': {
      'follows': true,
      'content_type': 'text/html',
      'length': html.length } }

  request({ // TODO use request's multipart
    method: 'PUT', 
    uri: this.db +'/'+ doc._id,
    headers: headers, 
    body: '--frontier\r\n' +
      'content-type: application/json\r\n' +
      '\r\n' +
      JSON.stringify(doc) +
      '\r\n--frontier\r\n' +
      '\r\n' +
      html +
      '\r\n--frontier--'
  }, callback);
};

Client.prototype.getAll = function(callback){

  var self = this,
      opts = this.opts || {},
      response_time = new Date();

  var run = function(err, resp, body){
    if(!err && resp.statusCode == 200){
      JSON.parse(body).rows.forEach(function(doc){
        val = doc.value;
        self.existing[doc.key.join('')] = { id: val.id, etag: val.etag };
      });
    }

    // Skanuj stronę główną i zapisz linki linii
    self.get(self.home, function($){
      var now = new Date();
      var lines = $ ? $(typeof opts.lines == 'object' ? opts.lines[0] : opts.lines) : [];

      async.forEachSeries(lines,
        function(link, cb){ self.getLine(link.href, cb) },
        function(){
          async.forEach(Object.keys(self.existing), function(uri, cb){
            //Deprecate old timetable.
            var old = self.existing[uri];
            request({
              method: 'PUT',
              uri: self.db +'/_design/Timetable/_update/dump/'+ old.id
            }, cb);
          }, function(){
            self.logger({ type:'Outdated', uris:self.outdated.concat(Object.keys(self.existing)) }, callback);
          });
        }
      )
    }, 'Home');
  }

  if(this.log){
    // Get etags of pages we will propably visit
    request({ uri: encodeURI(this.log +
              '/_design/couchapp/_view/recent_timetables'+
              '?startkey=["'+ this.server +'"]'+
              '&endkey=["'+ this.server +'",{}]'+
              '&group_level=2' )}, run);
  } else { // Won't attach if-none-match header to any request
    run(true)
  }
}

Client.prototype.getLine = function(uri, callback, opposite){

  var self = this;
  var opts = this.opts;

  if(opts.lines && opts.lines[1])
    uri = uri.replace(RegExp(opts.lines[1][0], 'g'), opts.lines[1][1])

  // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
  self.get(uri, function($){

    // Links to timetables
    var timetables = $ ? $(typeof opts.timetables == 'object' ? opts.timetables[0] : opts.timetables) : [];

    async.forEachSeries(timetables,
      function(link, cb){
        var href = link.href;
        if(opts.timetables[1])
          href = href.replace(RegExp(opts.timetables[1][0], 'g'), opts.timetables[1][1])
        self.getTimetable(href, cb);
      },
      function(){
        // Query opposite line
        if(!opposite && opts.opposite && $){
          // Links to opposite directions (lines)
          // Odwiedź wszystkie pozostałe linie i zapisz linki do przystanków
          var lines = $(opts.opposite);
          async.forEachSeries(lines, function(link, cb){
            self.getLine(link.href, cb, true);
          }, callback);
        } else { callback() }
      }
    );
  }, 'Line');
}

Client.prototype.getTimetable = function(uri, cb) {

  var self = this
  self.get(uri, function($, log, html){

    var uri = log.uri;

    old = self.existing[uri] || {};
    // Do not remove this timetable from database
    delete self.existing[uri];

    if($){
      var doc = self.parseTimetable($);
          doc.source = log.uri;

      if(log.response_time) log.response_time.db = new Date();

      self.put(doc, html, function(err, resp, body){
        if(!err){
          // New timetable was created
          if(self.log){
            if(resp.statusCode == 201){
              var ok = JSON.parse(body)
              log.creates = self.db.replace(/^(https?:\/\/)[^@:]+:[^@]+@/, '$1') +'/'+ ok.id +'?rev='+ ok.rev
            }
          }
          // Update log with timetable uri and db time
          self.logger(log);
          
          // Cancel old timetable
          if(old.id){
            // Timetable was updated
            var s = (doc.valid_from || '').split('.')
            var d = new Date(s[2], s[1], s[0]), month = d.getMonth();
            var valid_from = d.getDate() +'.'+ (month > 9 ? month : '0'+month) +'.'+ d.getFullYear();
            request({
              method: 'PUT',
              uri: self.db +'/_design/Timetable/_update/dump/'+ old.id +'?new_doc_since='+ valid_from
            }, function(){
              self.outdated.push(uri)
              if(cb) cb();
            })
          } else {
            // New timetable created
            if(cb) cb();
          }
        } else {
          // Conflict; this timetable already exists
          self.logger(log);
          if(cb) cb();
        } 
      });
    } else {
      // Reditection (or error) occured
      self.logger(log);
      if(cb) cb();
    }
  }, 'Timetable');
}

Client.prototype.parseTimetable = function($) {

  var self = this;
  var opts = self.opts || {};
  var doc = {};

  // Retrieves parameters
  // arg can be an Array or String selector
  var scrape = function(arg){
    var selector, regexp;
    if(typeof arg == "object"){
      selector = $(arg[0]);
      regexp = arg[1];
    } else {
      selector = $(arg);
    }
    if(selector.length) {
      var content = selector[0].textContent;
      if(regexp){
        var filtered = RegExp(regexp).exec(content);
        content = filtered ? filtered[1] : undefined;
      }
      if(content) return content.replace(/^\s+|\s+$/g, '');
    }
  }

  // Iterate over fields we're looking for
  var keys = ['valid_from', 'line', 'stop', 'route']
  keys.forEach(function(key){
    if(opts[key])
      doc[key] = scrape(opts[key]);
  })

  if(!doc.route && opts.destination){
    doc['destination'] = scrape(opts.destination);
  }

  // Just in case check if required selectors are provided
  if(!!opts.context && !!opts.days && !!opts.hours && !!opts.minutes){
    doc['table'] = {};

    // There are two types of timetables:
    // * columns (hours first then minutes)
    // * rows (hour, minutes and so on)
    var cols, were_minutes;
    var d = -1, day, hour, hours = [];

    $(opts.context).forEach(function(el){
      if($.matchesSelector(el, opts.days)){
        doc['table'][el.textContent] = {};
        were_minutes = false;
        hours = []; hour = undefined;
        cols = false;
        d += 1;
      } else if($.matchesSelector(el, opts.hours)){
        var days = Object.keys(doc['table']);
        var h = parseInt(el.textContent); // hour must be integer

        // Check if timetable reads vertically or horizontally
        if(d >= days.length || 
          (h === hour && h !== 0) ||
          (d > 0 && d+1 == days.length && !day))
          { d += 1 } // reading horizontally; increment day index

        day = days[d] || days[d%days.length];
      
        // Just in case timetable doesn't specify any days.
        // Example: http://www.zditm.szczecin.pl/rozklady/0___1007.11/0___1_2.htm
        if(!day){
          day = 'Undefined';
          doc['table'][day] = {};
        }

        if(were_minutes){
          if(cols){ // At least two hour-nodes in a row
            // There was a wrong assumption; we need to fix it
            var assigned_hours = Object.keys(doc['table'][day])
            // row which lost minutes
            var lost_minutes = hours.shift() || assigned_hours.pop();
            // rows which shouldn't have any minutes TODO many stolen_minutes
            var stolen_minutes = assigned_hours.reverse();
            // move minutes to latter hour
            stolen_minutes.forEach(function(row){
              doc['table'][day][lost_minutes] = doc['table'][day][row]
                                                .concat(doc['table'][day][lost_minutes] || []);
              delete doc['table'][day][row];
            })
            cols = false;
          }
          hours.push(h);
        } else { 
          if(hours.length > 0) cols = true;
          hours.unshift(h);
        }
      } else if($.matchesSelector(el, opts.minutes)){
        if(hours.length)
          hour = hours.pop();

        var minutes = (el.children.map ?
              el.children.map(function(e){ return e.textContent }) :
              (el.textContent || '').split(/\s+/)
            ).filter(function(m){ return m.match(/^\d/) });
        were_minutes = true;

        if(minutes.length){
          doc['table'][day][hour] = (doc['table'][day][hour] || []).concat(minutes);
        }
      }
    });
  }

  return doc;
}
