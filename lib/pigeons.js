var sys = require('sys')
  , fs = require('fs')
  , request = require('request')
  , Sizzle = require('./node-sizzle').Sizzle
  , Jsdom = require('jsdom')
  , couchapp = require('couchapp')
  , Iconv  = require('iconv').Iconv
  , uuid = require('node-uuid')
  , url = require('url')
  , stream = require('stream')
  , buffertools = require('buffertools')
  , async = require('async')
  ;

var sizzle = new Sizzle();

var Client = exports.Client = function(options, callback){

  var self = this;
  
  this.server = options.server;
  this.home = options.home;
  this.opts = options.get;
  this.db = options.db;
  this.code = options.code;
  this.request = request; // For tests TODO: get rid of this
  this.existing = {}; // Poor's man cache

  // No need to convert utf8 pages
  if(options.encoding) this.iconv = new Iconv(options.encoding, 'UTF-8');

  async.parallel([
    function(cb){
      if(options.log) {
        self.log = options.log;
        self.createCouchApp(cb);
      } else { cb() }
    },
    function(cb){
      // Create db if it doesn't exist
      if(self.db){
        request({ method: 'PUT', uri: self.db }, function(err, resp, body){
          if(!err && resp.statusCode == 201){
            request({ method: 'POST',
                      uri: self.db +'/_design/Timetable',
                      body: '{ views: { "active": { "map": "function(doc) { if(doc.type == \"Timetable\" && doc.valid_until == undefined) emit(doc._id, doc); }" }}}'
            }, cb)
          } else { cb() }
        })
      } else { cb() }
    }
  ], function(){ if(callback) callback.call(self) });
}

Client.prototype.createCouchApp = function(cb){
  couchapp.createApp(require(__dirname +'/../couch/app.js'), this.log, function(app){
    app.push(cb) 
  });
}

Client.prototype.logger = function(doc, callback){
  if(this.log){
    doc.created_at = new Date();
    doc.db = this.code;

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
  var body = ''
    , match = path.match(/\/(\/.*)$/)
    , uri = this.server + (match ? match[1] : path)
    , now = new Date()
    , self = this
    , etag = (self.existing[uri] || {}).etag;

  var body_stream = new stream.Stream();
  body_stream.writable = true

  // Sends a request and pipes response to `body_stream` stream
  request({ uri: uri, headers: { 'if-none-match': etag }}, function(error, resp){
    if(error){ throw uri +': '+ error }
    response = resp;
  }).pipe(body_stream);

  body_stream.write = function(chunk){ body = buffertools.concat(body, chunk) }
  body_stream.end = function(){
    var log = {
      uri: uri,
      type: type,
      headers: response.headers,
      statusCode: response.statusCode,
      response_time: { remote: now }}

    body = self.iconv ? self.iconv.convert(body) : body
    self.logger(log, function(doc){
      var root = url.parse(uri).pathname.match(/^.*\//)[0]; // todo specs
      var opts = {url: root, features: {FetchExternalResources: false, ProcessExternalResources: false}};
      var dom = Jsdom.jsdom(body.toString(), null, opts).createWindow();
      if(callback) callback(sizzle.run(dom.document), doc || log, body, response.statusCode == 200);
    });
  }
};

Client.prototype.put = function(doc, html, callback){
  if(!this.db) return;
  var id = doc._id || uuid().replace(/-/g, '');
  var headers = { 'Content-Type': 'multipart/related;boundary="frontier"' };
  var self = this;

  doc.type = 'Timetable';
  doc.created_at = new Date();
  doc._attachments = {
    'source.html': {
      'follows': true,
      'content_type': 'text/html',
      'length': html.length } }

  request({ // TODO use request's multipart
    method: 'PUT', 
    uri: this.db +'/'+ id, 
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

  request({ uri: this.db +'/_design/Timetable/_view/active' }, function(err, resp, body){

    if(resp.statusCode == 200)
      JSON.parse(body).rows.forEach(function(doc){
        doc = doc.value;
        self.existing[doc.source] = { etag: doc.etag, id: doc._id, valid_from: doc.valid_from };
      });

    // Skanuj stronę główną i zapisz linki linii
    self.get(self.home, function($){

      var now = new Date();
      var lines = $(typeof opts.lines == 'object' ? opts.lines[0] : opts.lines);

      async.forEachSeries(lines,
        function(link, cb){ 
          var href = link.href;
          if(opts.lines && opts.lines[1])
            href = href.replace(RegExp(opts.lines[1][0], 'g'), opts.lines[1][1])
          self.getLine(href, cb)
        },
        function(){
          async.forEach(Object.keys(self.existing), function(uri, cb){
            // Deprecate old timetable.
            var old = self.existing[uri];
            request({
              method: 'PUT',
              uri: self.db +'/_design/Timetable/_update/dump/'+ old.id +'?new_doc_since=null'
            }, cb);
          }, function(){
            self.logger({ type: 'Deprication', urls: Object.keys(self.existing) }, callback);
          });
        }
      )
    }, 'Home');
  });
}

Client.prototype.getLine = function(uri, callback, opposite){

  var self = this;
  var opts = this.opts;

  // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
  self.get(uri, function($){

    // Links to timetables
    var timetables = $(typeof opts.timetables == 'object' ? opts.timetables[0] : opts.timetables);

    async.forEachSeries(timetables,
      function(link, cb){
        var href = link.href;
        if(opts.timetables[1])
          href = href.replace(RegExp(opts.timetables[1][0], 'g'), opts.timetables[1][1])
        self.getTimetable(href, cb);
      },
      callback
    );

    // It will query opposite line simultaneously
    if(!opposite && opts.opposite){
      // Links to opposite directions (lines)
      // Odwiedź wszystkie pozostałe linie i zapisz linki do przystanków
      var lines = $(opts.opposite);
      async.forEachSeries(lines, function(link, cb){
        self.getLine(url.resolve(uri, link.href), cb, true);
      });
    }
  }, 'Line');
}

Client.prototype.getTimetable = function(uri, cb) {

  var self = this;
  old = self.existing[self.server + uri] || {};

  //var timetable = this.mpk.request('GET', url, { 'host': this.server, 'If-None-Match': old.etag || "", 'Connection': 'keep-alive'})
  //timetable.end();
  //var response_time = new Date();

  //timetable.on('response', function(response){

    //var html = ''
    //response.on('data', function(chunk){
      //html += self.iconv ? self.iconv.convert(chunk) : chunk
    //})

    //response.on('end', function(){
  self.get(uri, function($, log, html, ok){

    // [logger] database and server response times
    //var db_time;
    //response_time = new Date() - response_time;

    if(ok){

      var doc = self.parseTimetable($);
          doc.source = self.server + uri;

      if(log)
          doc.etag = log.headers.etag;

      // Another level of caching
      // TODO: handle future dates
      
      if(!doc.valid_from || doc.valid_from != old.valid_from){

        // New timetable avaliable - putting it in the database
        if(log) log.response_time.db = new Date();

        self.put(doc, html, function(err, resp, body){

          if(self.log){
            if(body){
              var ok = JSON.parse(body)
              log.creates = self.db.replace(/^(https?:\/\/)[^@:]+:[^@]+@/, '$1') +'/'+ ok.id +'?rev='+ ok.rev
            } else { throw err }
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
              delete self.existing[self.server + uri];
              if(cb) cb();
            })
          } else {
            // New timetable created
            if(cb) cb();
          }
        });
      } else {
        // Timetable has not changed
        self.logger(log);
        if(cb) cb();
      }
    } else {
      // Reditection occured
      self.logger(log);
      if(cb) cb()
    }
  }, 'Timetable');
}

Client.prototype.parseTimetable = function($) {

  var self = this;
  var opts = self.opts || {};
  var doc = {};

  // Retrives parameters
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
        if(filtered) content = filtered[1];
        else content = undefined
      }
      if(content) return content.replace(/^\s+|\s+$/g, '');
    }
  }

  var aa = ['valid_from', 'line', 'stop', 'route'];
  aa.forEach(function(key){
    if(opts[key])
      doc[key] = scrape(opts[key]);
  })

  if(!doc.route && opts.destination){
    doc['destination'] = scrape(opts.destination);
  }

  if(!!opts.context && !!opts.days && !!opts.hours && !!opts.minutes){
    doc['table'] = {};

    var d = -1, // indexes of: minutes, hours, days
        day, hour, hours = [];
    var cols, were_minutes;

    $(opts.context).forEach(function(el){
      if($.matchesSelector(el, opts.days)){
        doc['table'][el.textContent] = {};
        were_minutes = false;
        hours = [];
        cols = false;
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

        if(hours.length == 0){
          hours = [h];
        } else if(were_minutes != false){
          if(cols == true ){ // At least two hour-nodes in a row
            hr = Object.keys(doc['table'][day])[0];
            doc['table'][day][hours.shift()] = doc['table'][day][hr];
            delete doc['table'][day][hr];
            cols = false
          }
          hours.push(h);
        } else { 
          cols = true;
          hours.unshift(h)
        };

      } else if($.matchesSelector(el, opts.minutes)){
        if(hours.length)
          hour = hours.pop();

        var minutes = (el.children.length > 1 ?
              Array.prototype.slice.call(el.children).map(function(e){return e.textContent}) :
              (el.textContent || '').split(/\s+/)
            ).filter(function(m){return m!='' && m!='-'});
        var result = (doc['table'][day][hour] || []).concat(minutes);
        were_minutes = true;

        if(result.length){
          if(!doc['table'][day][hour])
            doc['table'][day][hour] = [];
          doc['table'][day][hour] = result;
        }
      }
    });
  }

  return doc;
}
