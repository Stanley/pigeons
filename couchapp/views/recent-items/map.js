function(doc) {
  emit([doc.db, doc.created_at], doc.response_time);
};
