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

exports.createResponse = function(text){
  return function(req, resp){
    if(req.method == 'PUT'){
      req.on('end', function () {
        resp.writeHead(201, {'content-type':'application/json'});
        resp.write(text);
        resp.end();
      })
    } else {
      resp.writeHead(200, {'content-type':'application/json'});
      resp.write(text);
      resp.end();
    }
  }
}
