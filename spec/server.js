var http = require('http')
  , events = require('events')
  ;

exports.createServer = function(port, cb){
  var server = http.createServer(function(req, resp){
    server.emit(req.url, req, resp);
  });
  server.listen(port, cb);
  return server;
}

exports.createGetResponse = function(text){
  return function(req, resp){
    resp.writeHead(200, {'content-type':'text/plain'});
    resp.write(text);
    resp.end();
  }
}
