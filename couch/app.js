var couchapp = require('couchapp')
  , path = require('path');

ddoc = {
  _id: '_design/couchapp'
, views: {} , lists: {} , shows: {} 
}

ddoc.views.runs = {
  map: function(doc) {
    if(doc.type == 'Root')
      emit([doc.db, doc.created_at], doc.items) 
  }
}

ddoc.views.timetables = {
  map: function(doc) {
    if(doc.type == 'Timetable')
      emit([doc.db, doc.created_at, doc.url], {
        id: doc.doc, 
        valid_from: doc.valid_from,
        etag: doc.headers ? doc.headers.etag : undefined
      });
  }
, reduce: function (key, values, rereduce) {
    if(rereduce)
      return sum(values);
    else
      return values.length
  }
}

module.exports = ddoc;
//couchapp.loadAttachments(ddoc, path.join(__dirname, '_attachments'));
