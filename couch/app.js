var couchapp = require('couchapp')
  , path = require('path');

ddoc = {
  _id: '_design/couchapp'
, views: {} , lists: {} , shows: {} 
}

ddoc.views.runs = {
  map: function(doc) {
    if(doc.type == 'Home')
      emit([doc.db, doc.created_at], doc.items) 
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

ddoc.views['recent-items'] = {
  map: function(doc){
    emit([doc.db, doc.created_at], doc.response_time);
  }
}

ddoc.views['status-code'] = {
  map: function(doc) {
    if(doc.statusCode) emit([doc.db, doc.created_at], doc.statusCode);
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
    if(doc.type == 'Line')
      emit([doc.db, doc.created_at], null);
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

ddoc.views['timetables'] = {
  map: function(doc) {
    if(doc.type == 'Timetable')
      emit([doc.db, doc.created_at], {
        id: doc.doc, 
        valid_from: doc.valid_from,
        etag: doc.headers.etag
      });
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

ddoc.views['new-timetables'] = {
  map: function(doc) {
    if(doc.type == 'Timetable' && (doc.creates || doc.updates))
      emit([doc.db, doc.created_at], null);
  },
  reduce: function (key, values, rereduce) {
    if(rereduce) return sum(values);
    else return values.length
  }
}

module.exports = ddoc;
couchapp.loadAttachments(ddoc, path.join(__dirname, '_attachments'));
