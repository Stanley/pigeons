describe('Remote server', function(){

  var async = require('async');
  var server, db;

  beforeEach(function(){
    var started;
    async.parallel([
      function(cb){
        server = s.createServer(6000, cb);
      }, function(cb){
        db = s.createServer(6001, cb);
      }
    ], function(){ started = true });
    waitsFor(function(){ return started });
  });

  afterEach(function(){
    server.close();
    db.close();
  })

  it('timeouts', function(){
    server.once('/', function(){
      // TODO
    });
  });

  it('fails', function(){
    server.once('/', function(req, resp){
      resp.writeHead(500, {'content-type':'application/json'});
      resp.write(JSON.stringify({error: "Bad Request"}));
      resp.end();
    });

    var finished;
    var pigeons = new Pigeons({ server: 'http://localhost:6000' });
    pigeons.get('/', function($, log, body, ok){
      expect($).toBeUndefined();
      expect(body.toString()).toEqual('{"error":"Bad Request"}');
      expect(ok).toBeFalsy();
      finished = true;
    });
    waitsFor(function(){ return finished });
  });
});
