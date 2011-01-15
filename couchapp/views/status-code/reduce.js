function (key, values, rereduce) {
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
