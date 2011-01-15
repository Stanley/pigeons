function (key, values, rereduce) {
  if(rereduce)
    return sum(values);
  else
    return values.length
}
