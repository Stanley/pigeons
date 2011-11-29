var couchapp = require('couchapp')
  , path = require('path');

ddoc = {
  _id: '_design/couchapp'
, views: {} , lists: {} , shows: {} 
}

ddoc.views.runs = {
  map: function(doc) {
    var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
    if(doc.type == 'Home')
      emit([source, doc.created_at], doc.items) 
  }
}

//ddoc.views.timetables = {
  //map: function(doc) {
    //if(doc.type == 'Timetable')
      //emit([doc.db, doc.created_at, doc.url], null);
  //}
//, reduce: function (key, values, rereduce) {
    //if(rereduce)
      //return sum(values);
    //else
      //return values.length
  //}
//}

ddoc.views['recent_items'] = {
  map: function(doc){
    var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
    emit([source, doc.created_at], doc.response_time);
  }
}

ddoc.views['status_code'] = {
  map: function(doc) {
    var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
    if(doc.statusCode) emit([source, doc.created_at], doc.statusCode);
  },
  reduce: function (key, values, rereduce) {
    var map = {}
    if(rereduce){
      // Array of objects
      values.forEach(function(val){
        for(code in val){
          map[code] = (map[code]+val[code]) || val[code];
        }
      })
    } else {
      // Array of status codes
      values.forEach(function(code){
        map[code] = (map[code]+1) || 1;
      })
    }
    return map
  }
}

ddoc.views['lines'] = {
  map: function(doc) {
    if(doc.type == 'Line'){
      var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
      emit([source, doc.created_at], null);
    }
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

ddoc.views['timetables'] = {
  map: function(doc) {
    if(doc.type == 'Timetable'){
      var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
      emit([source, doc.created_at], {
        id: doc.doc, 
        valid_from: doc.valid_from,
        etag: doc.headers.etag
      });
    }
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

ddoc.views['new_timetables'] = {
  map: function(doc) {
    if(doc.type == 'Timetable' && (doc.creates || doc.updates)){
      var source = doc.uri.match(/^http\:\/\/([^\/]+[a-z])\//)[1]
      emit([source, doc.created_at], null);
    }
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

ddoc.views['recent_timetables'] = {
  map: function(doc){
    if(doc.type && doc.type == 'Timetable'){
      var uri = doc.uri.match(/(http\:\/\/[^\/]+[a-z])(\/.+$)/).slice(1,3)
      emit(uri.concat(doc.created_at), doc.headers.etag)
    } else if(doc.type && doc.type == 'Outdated'){
      doc.uris.forEach(function(uri){
        var uri = uri.match(/(http\:\/\/[^\/]+[a-z])(\/.+$)/).slice(1,3)
        emit(uri.concat([doc.created_at, doc.type]))
      })
    }
  },
  reduce: function(keys, values, rereduce){
    if(!keys) return {}
    pairs = keys.map(function(key,i){ return [key[0][2], {etag:values[i], type:key[0][3]}] });
    var latest = pairs.sort()[pairs.length-1][1];
    return latest;
  }
}

module.exports = ddoc;
couchapp.loadAttachments(ddoc, path.join(__dirname, '_attachments'));
