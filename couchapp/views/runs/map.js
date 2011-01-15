function(doc) {
  if(doc.type == 'Root')
    emit([doc.db, doc.created_at], doc.items) 
}
