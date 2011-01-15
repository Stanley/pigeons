function(doc) {
  if(doc.type == 'Deletion')
    emit([doc.db, doc.created_at], null);
}
