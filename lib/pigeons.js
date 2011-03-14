var sys = require('sys')
  , fs = require('fs')
  , http = require('http')
  , request = require('request')
  , Sizzle = require('./node-sizzle').Sizzle
  , couchapp = require('couchapp')
  , Iconv  = require('iconv').Iconv
  , uuid = require('node-uuid')

var sizzle = new Sizzle();

var Client = exports.Client = function(options, callback){
  
  this.base_url = options.server;
  this.home = options.home;
  this.opts = options.get;
  this.existing = {}; // Poor's man cache
  this.db = options.db;
  this.request = request; // For tests

  // No need to convert utf8 pages
  //if(options.encoding) this.iconv = new Iconv(options.encoding, 'UTF-8');

  if(options.log) {
    this.log = options.log;
    couchapp.createApp(require(process.env.PWD +'/couch/app.js'), this.log, function(app){
      app.push();
    });
  }

  var self = this;
  
  // Create db if it doesn't exist
  if(this.db){
    request({ method: 'PUT', uri: this.db }, function(error){
      if(!error){ // push views
        ['Stop', 'Timetable'].forEach(function(name){
          var data = fs.readFileSync(__dirname +'/../views/'+ name +'.json', 'utf8')
                       .replace(/\n\s*/g, '');
          request({ method: 'PUT', uri: self.db + '/_design/'+ name, body: data });
        });
      }
      if(callback) callback();
    });
  }
}

Client.prototype.logger = function(doc){
  if(this.log){
    if(typeof doc == 'object') this.temp_log = doc;
    else {
      var updates;
      if(doc) updates = doc;
      doc = this.temp_log;
      if(updates) doc.updates = updates;
    }

    doc.created_at = new Date();
    doc.type = this.lastType;
    // TODO: response_time
    if(doc.type == 'Timetable' && doc.statusCode < 400 && !doc.db_time){ // Don't write to db just yet.
      doc.db_time = new Date();
    } else {
      if(doc.db_time) doc.db_time = new Date() - doc.db_time;
      this.request({
        method: 'POST',
        uri: this.log,
        json: doc
      });
    }
  }
}

//Client.defaults = function(url){
  //var root = url.split('/').slice(0,-1).join('/') + '/';
  //return {url: root, features: {FetchExternalResources: false, ProcessExternalResources: false}};
//};

Client.prototype.get = function(path, callback){
  //var log = {};
  var self = this,
      uri = this.base_url + path;

  request({ uri: uri }, function(error, response, body){
    if(error){
      // log.error = error
      //throw error
    } else {
      var options = {}; // Client.defaults()
      var dom = Jsdom.jsdom(body, null, options).createWindow();
      if(callback) callback(response, sizzle.run(dom.document), body)
    }

    self.logger({ uri: uri, headers: response.headers, statusCode: response.statusCode });
  });
};

Client.prototype.put = function(doc, html, callback){
  var id = doc._id || uuid().replace(/-/g, '');
  var headers = { 'Content-Type': 'multipart/related;boundary="frontier"' };
  var content = new Buffer(html);
  var self = this;

  doc.created_at = new Date();
  doc._attachments = {
    'source.html': {
      'follows': true,
      'content_type': 'text/html',
      'length': content.length } }

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
      content +
      '\r\n--frontier--'
  }, function(){
    if(callback) callback();
  });
};

Client.prototype.getAll = function(callback){

  var self = this,
      opts = this.opts || {},
      response_time = new Date();

  var scrape = function(){
    // Skanuj stronę główną i zapisz linki linii
    self.get(self.home, function(response, $){

      var now = new Date();
      var lines = $(typeof opts.lines == 'object' ? opts.lines[0] : opts.lines);

      var cb = function(){
        if(lines.length){
          var href = lines.shift().href; //.replace(/http:\/\/[\w.]+\//, '')
          if(typeof opts.lines == 'object')
            href = href.replace.apply(href, opts.lines[1]);
          self.getLine(href, cb, true);
        } else {
          // Remove old timetables
          this.lastType = 'Deletion';
          var urls = Object.keys(self.existing);
          var left_timetables = urls.length;
          var finalize = function(){ if(!left_timetables-- && callback) callback(); }
          finalize(); // In case `urls` is empty
          urls.forEach(function(url){
            var doc = self.existing[url];
            var db_time = new Date();
            self.request({ method: 'DELETE', uri: self.db +'/'+ doc.id +'?rev='+ doc.rev }, function(){ finalize() });
            self.logger({ doc: doc.id, rev: doc.rev });
          })
        }
      }
      cb()
    })
  }

  // Get time of last check
  if(this.log){
    var db = (new RegExp(/(\w+)$/)).exec(this.db)[1];
    request({
      uri: this.log +'/_design/couchapp/_view/runs?limit=1&descending=true'+
           '&startkey='+ escape(JSON.stringify([db,{}]))
    }, function(error, response, body){
      var rows = JSON.parse(body).rows;
      if(!error && rows && rows.length){
        request({
          uri: self.log +'/_design/couchapp/_view/timetables?descending=true&reduce=false'+
               '&startkey='+ escape(JSON.stringify([db, {}])) +
               '&endkey='+ escape(JSON.stringify([db, rows[0].key[1]]))
        }, function(error, response, body){
          var docs = JSON.parse(body).rows;
          docs.forEach(function(doc){
            self.existing[doc.key[2]] = doc.value.valid_from;
          });
          scrape();
        });
      } else {
        scrape();
      }
    })
  } else {
    scrape();
  }
}

Client.prototype.getLine = function(uri, cb, is_first){

  var self = this;
  var opts = this.opts;
  var url;

  if(uri.slice(0,7) == 'http://')
    url = uri.slice(7);
  else
    url = uri 

  //var root = url.split('/').slice(0,-1).join('/') + '/';
  //var response_time = new Date();

  // Odwiedź wszystkie linie i zapisz linki do przystanków i przeciwnych linii
  //std.write('.'); // Request line
  self.get(url, function(response, $){

    var now = new Date();

    // Logger
    //self.log({
      //headers: response.headers,
      //status: response.statusCode,
      //type: "Line",
      //created_at: now,
      //response_time: {remote: now - response_time},
      //url: "http://" + self.base_url + url
    //});

    // Links to timetables
    var timetables = $(typeof opts.timetables == 'object' ? opts.timetables[0] : opts.timetables);

    var nextTimetable = function(){
      if(timetables.length){ // TODO timetables.shift().replace()
        var href = timetables.shift().href.replace(/http:\/\/[\w.]+\//, '')
        //href = href.replace.apply(href, opts.timetables[1])
        if(opts.timetables[1])
          href = href.replace(RegExp(opts.timetables[1][0]), opts.timetables[1][1])
        self.getTimetable(href, nextTimetable);
      } else
        cb()
    }
    nextTimetable()

    // It will query opposite line simultaneously
    if(is_first && opts.opposite){
      // Links to opposite directions (lines)
      // Odwiedź wszystkie pozostałe liniie i zapisz linki do przystanków
      var lines = $(opts.opposite);
      var base = uri.split('/');
      var nextLine = function(){
        if(lines[0])
          self.getLine(base.slice(0, base.length-1).join('/') +'/'+ lines.shift().href, nextLine)
      }
      nextLine()
    }
  })
}

Client.prototype.getTimetable = function(uri, cb) {

  // Debugging
  //cb = function(){
  //  throw "debugger mode on"
  //}

  //if(link.slice(0,7) == 'http://'){
    //url = link.slice(7) // TODO slice server ?
      //throw "?"
  //} else {
    //var base = uri.split('/');
    //url = link; 
  //}

  this.lastType = 'Timetable';
  var self = this;
  old = self.existing[self.base_url + uri] || {};

  //std.write('*'); // Request timetable
  //var timetable = this.mpk.request('GET', url, { 'host': this.base_url, 'If-None-Match': old.etag || "", 'Connection': 'keep-alive'})
  //timetable.end();
  //var response_time = new Date();

  //timetable.on('response', function(response){

    //var html = ''
    //response.on('data', function(chunk){
      //html += self.iconv ? self.iconv.convert(chunk) : chunk
    //})

    //response.on('end', function(){
    self.get(uri, function(response, $, html){

      // [logger] database and server response times
      //var db_time;
      //response_time = new Date() - response_time;

      if(response.statusCode == 200){

        var doc = self.parseTimetable($);
            doc.url = self.base_url + uri;

        // Another level of caching
        // TODO: handle future dates
        
        if(!doc.valid_from || doc.valid_from != old.valid_from){
          // New timetable avaliable; put it in the database
          self.put(doc, html, function(){
            if(old.id){ // Cancel old timetable
              // Timetable was updated
              request({
                method: 'PUT',
                uri: self.db +'/_design/Timetable/_update/dump/'+ old.id +'?new_doc_since='+ doc.valid_from
              }, function(){
                self.logger(old.id); // Finish off log
                if(cb) cb();
              })
            } else { // New timetable created
              self.logger(); // Finish off log
              if(cb) cb();
            }
          });
        } else { // Timetable has not changed
          if(cb) cb();
        }
      } else { // Error or reditection occured
        if(cb) cb()
      }
    })
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
    var value = selector.length ? selector[0].textContent : '';
    return regexp ? RegExp(regexp).exec(value)[1] : value;
  }

  var aa = ['valid_from', 'line', 'stop', 'route'];
  aa.forEach(function(key){
    if(opts[key])
      doc[key] = scrape(opts[key]);
  })

  if(!doc.route && opts.destination){
    doc['destination'] = scrape(opts.destination);
  }

  if(opts.context && opts.days && opts.hours && opts.minutes){
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
              (el.textContent || '').split(/\s+/)
            ).filter(function(m){return m!='' && m!='-'});
        var result = (doc['table'][day][hour] || []).concat(minutes);

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
