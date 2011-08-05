describe('parser', function(){

  describe('timetable', function(){
    var config = {
      get: {
        context: 'div',
        days: '.day',
        hours: '.hour',
        minutes: '.minute'
      }
    };

    it('should read DOM vertically', function(){
      var body = "                    \
        <div class='day'>first</div>  \
        <div class='day'>second</div> \
        <div class='day'>third</div>  \
        <div class='hour'>4</div>     \
        <div class='minute'>01</div>  \
        <div class='hour'>4</div>     \
        <div class='minute'></div>    \
        <div class='hour'>4</div>     \
        <div class='minute'></div>    \
        <div class='hour'>5</div>     \
        <div class='minute'></div>    \
        <div class='hour'>5</div>     \
        <div class='minute'>02</div>  \
        <div class='hour'>5</div>     \
        <div class='minute'></div>    \
        <div class='hour'>6</div>     \
        <div class='minute'></div>    \
        <div class='hour'>6</div>     \
        <div class='minute'></div>    \
        <div class='hour'>6</div>     \
        <div class='minute'>03</div>  \
        <div class='hour'>7</div>     \
        <div class='minute'>04</div>  \
        <div class='hour'>7</div>     \
        <div class='minute'></div>    \
        <div class='hour'>7</div>     \
        <div class='minute'></div>    \
        <div class='hour'>8</div>     \
        <div class='minute'></div>    \
        <div class='hour'>8</div>     \
        <div class='minute'>05</div>  \
        <div class='hour'>8</div>     \
        <div class='minute'></div>    \
        <div class='hour'>9</div>     \
        <div class='minute'></div>    \
        <div class='hour'>9</div>     \
        <div class='minute'></div>    \
        <div class='hour'>9</div>     \
        <div class='minute'>06</div>";

      expect((new Pigeons(config)).parseTimetable(Sizzle(body)).tables).toEqual({
        first:  {4: ['01'], 7: ['04']},
        second: {5: ['02'], 8: ['05']},
        third:  {6: ['03'], 9: ['06']}
      })
    });

    it('should read DOM horizontally', function(){
      var body = "                    \
        <div class='day'>first</div>  \
        <div class='hour'>3</div>     \
        <div class='hour'>4</div>     \
        <div class='minute'>01</div>  \
        <div class='hour'>5</div>     \
        <div class='hour'>7</div>     \
        <div class='minute'>04</div>  \
        <div class='day'>second</div> \
        <div class='hour'>5</div>     \
        <div class='minute'>02</div>  \
        <div class='hour'>7</div>     \
        <div class='hour'>8</div>     \
        <div class='minute'>05</div>  \
        <div class='day'>third</div>  \
        <div class='hour'>4</div>     \
        <div class='hour'>5</div>     \
        <div class='hour'>6</div>     \
        <div class='minute'>03</div>  \
        <div class='hour'>9</div>     \
        <div class='minute'>06</div>";

      expect((new Pigeons(config)).parseTimetable(Sizzle(body)).tables).toEqual({
        first:  {4: ['01'], 7: ['04']},
        second: {5: ['02'], 8: ['05']},
        third:  {6: ['03'], 9: ['06']}
      })
    });

    it('should read collumns', function(){
      var body = "                    \
        <div class='day'>first</div>  \
        <div class='hour'>4</div>     \
        <div class='hour'>7</div>     \
        <div class='minute'>01</div>  \
        <div class='minute'>04</div>  \
        <div class='day'>second</div> \
        <div class='hour'>5</div>     \
        <div class='hour'>8</div>     \
        <div class='minute'>02</div>  \
        <div class='minute'>05</div>  \
        <div class='day'>third</div>  \
        <div class='hour'>6</div>     \
        <div class='hour'>9</div>     \
        <div class='minute'>03</div>  \
        <div class='minute'>06</div>";

      expect((new Pigeons(config)).parseTimetable(Sizzle(body)).tables).toEqual({
        first:  {4: ['01'], 7: ['04']},
        second: {5: ['02'], 8: ['05']},
        third:  {6: ['03'], 9: ['06']}
      });
    });

    it('should read rows and not confuse with collumns', function(){
      var body1 = "                   \
        <div class='day'>first</div>  \
        <div class='hour'>4</div>     \
        <div class='hour'>5</div>     \
        <div class='minute'>02</div>  \
        <div class='minute'>03</div>  \
        <div class='hour'>6</div>     \
        <div class='minute'>04</div>  \
        <div class='hour'>7</div>     \
        ";
      
      var body2 = "                   \
        <div class='day'>first</div>  \
        <div class='hour'>4</div>     \
        <div class='hour'>5</div>     \
        <div class='hour'>6</div>     \
        <div class='minute'>02</div>  \
        <div class='minute'>03</div>  \
        <div class='hour'>7</div>     \
        <div class='minute'>04</div>  \
        <div class='hour'>8</div>     \
        ";

      expect((new Pigeons(config)).parseTimetable(Sizzle(body1)).tables).toEqual({
        first: {5: ['02','03'], 6:['04']}
      });

      expect((new Pigeons(config)).parseTimetable(Sizzle(body2)).tables).toEqual({
        first: {6: ['02','03'], 7:['04']}
      });
    });

    it('should return to default values after each table', function(){ 
      var body = "                    \
        <div class='day'>first</div>  \
        <div class='hour'>3</div>     \
        <div class='hour'>4</div>     \
        <div class='minute'>01</div>  \
        <div class='hour'>5</div>     \
        <div class='hour'>6</div>     \
        <div class='day'>second</div> \
        <div class='hour'>3</div>     \
        <div class='minute'>02</div>  \
        <div class='hour'>4</div>     \
        <div class='hour'>5</div>     \
        <div class='minute'>05</div>  \
        ";

      expect((new Pigeons(config)).parseTimetable(Sizzle(body)).tables).toEqual({
        first:  {4: ['01']},
        second: {3: ['02'], 5: ['05']}
      })
    });
  });

  it('should read the time from when it is valid', function(){
    var config = { get: { valid_from: [".valid_from", "(\\d{2}\.\\d{2}\.\\d{4})"] }}
    var body = "<span class=\"valid_from\">Rozkład ważny od: 20.01.2011r.</span>";

    expect((new Pigeons(config)).parseTimetable(Sizzle(body)).valid_from).toEqual("20.01.2011");
  });

  it('should find and trim properties', function(){
    var config = {get: {route: ".Route",
                        destination: ".Destination",
                        stop: ".StopName",
                        line: ".LineNumber"}};
    var pigeons = new Pigeons(config);
    var body = "<span class=\"Route\">START - Stop - META</span>"+
               "<span class=\"Destination\">Nibylandia</span>"+
               "<span class=\"StopName\">  Teatr Bagatela  </span>"+
               "<span class=\"LineNumber\">11\n</span>";
    var timetable = pigeons.parseTimetable(Sizzle(body));

    expect(timetable).toEqual({ line: "11", stop: "Teatr Bagatela", route: "START - Stop - META" });
  });

  it('should execute regular expressions on properties', function(){
    var config = {get: {route: [".Route", "^Trasa: (.+)$"],
                        stop: [".StopName", "^Przystanek: (.+)$"],
                        line: [".LineNumber", "^==\\s(.+)\\s==$"]}};
    var pigeons = new Pigeons(config);
    var body = "<span class=\"Route\">Trasa: START - Stop - META</span>"+
               "<span class=\"StopName\">Przystanek: Teatr Bagatela</span>"+
               "<span class=\"LineNumber\">== 11 ==</span>";
    var timetable = pigeons.parseTimetable(Sizzle(body));

    expect(timetable).toEqual({ line: "11", stop: "Teatr Bagatela", route: "START - Stop - META" });
  });

  it('should not throw on not found properties', function(){
    var config = { get: { route: [".Route", "^Trasa: (.+)$"], stop: [".StopName", "^Przystanek: (.+)$"], line: ".LineNumber" }};
    var pigeons = new Pigeons(config);
    var body = "<span class=\"Route\"></span>"+
               "<span class=\"StopName\">Przystanek: </span>"+
               "<span class=\"LineNumber\"></span>";
    var timetable = pigeons.parseTimetable(Sizzle(body));

    expect(timetable).toEqual({});
  });

  describe('destination property', function(){

    it('should be added if route path is not defined', function(){
      var config = { get: { destination: ".Destination" }};
      var pigeons = new Pigeons(config);
      var body = "<span class=\"Destination\">Nibylandia</span>";
      var timetable = pigeons.parseTimetable(Sizzle(body));

      expect(timetable.destination).toEqual("Nibylandia");
    });

    it('should execute regular expressions', function(){
      var config = { get: { destination: [".Destination", "^Koniec: (.+)$"] }};
      var pigeons = new Pigeons(config);
      var body = "<span class=\"Destination\">Koniec: Nibylandia</span>";
      var timetable = pigeons.parseTimetable(Sizzle(body));

      expect(timetable.destination).toEqual("Nibylandia");
    });
  });
});
