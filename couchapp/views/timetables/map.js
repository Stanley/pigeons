function(doc) {
  if(doc.type == 'Timetable')
    emit([doc.db, doc.created_at, doc.url], {
      id: doc.doc, 
      valid_since: doc.valid_since,
      etag: doc.headers.etag
    });
}