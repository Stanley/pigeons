function(doc) {
  if(doc.type == 'Timetable' && doc.doc)
    emit([doc.db, doc.created_at], null);
}
