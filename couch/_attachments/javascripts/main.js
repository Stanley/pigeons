$.couch.app(function(app){ 


  //chart = new Highcharts.Chart({
  var chart_options = {
    chart: {
      renderTo: 'chart',
      backgroundColor: 'rgba(0,0,0,0)',
      margin: [0, 0, 0, 0],
      //events: {
        //load: function() {
  
          //// set up the updating of the chart each second
          //var series = this.series[0];
          //setInterval(function() {
            //var x = (new Date()).getTime(), // current time
              //y = Math.random();
            //series.addPoint([x, y], true, true);
          //}, 1000);
        //}
      //}
    },
    colors: [ '#ff9900' ],
    xAxis: {
      labels: {
        enabled: false
      }
    },
    yAxis: {
      labels: {
        enabled: false
      },
      title: {
               text: null
             },
      gridLineColor: '#6a9bba',
      max: 1000,
      min: 0
    },
    legend: {
      enabled: false
    },
    exporting: {
      enabled: false
    },
    title: {
      text: null
    },
    //series: [{
      //name: 'Random data',
      //data: (function() {
        //// generate an array of random data
        //var data = [],
          //time = (new Date()).getTime(),
          //i;
        //for (i = -119; i <= 0; i++) {
          //data.push({
            //x: time + i * 1000,
            //y: Math.random()
          //});
        //}
        //return data;
      //})(),
      //lineWidth: 2,
      //marker: {
        //enabled: false
      //}
    //}],
    tooltip: {
      formatter: function() {
        var s = ''
        $.each(this.points, function(i, point) {
          s += point.series.name +': '+
          point.y +' ms.'+'<br/>';
        });
        return s;
      },
      borderWidth: 0,
      shared: true
    },
    credits:{
      enabled: false
    },
    plotOptions: {
      series: {
        states: {
          hover: {
            enabled: false
          }
        },
        marker: {
                  radius: 1
                },
        shadow: false,
        animation: false
      }
    }
  }
  
  var select = $('#city');
  var past = $('#past');
  var div = $('#past');
  
  select.change(function(){
    var db = $(this).val()
    div.empty();
    app.view('runs', {
      startkey: [db, {}],
      endkey: [db],
      descending: true,
      success: function(json){
        json.rows.forEach(function(day){
          var start = day.key[1]
          var date = new Date(start);
          var link = $('<a />')
          .text(date.getDate() +'.'+ date.getMonth()+1)
          .attr('href', '#!/'+ app.db.name +'/'+ day.id)
          .attr('rel', start)
          .click(function(){
             var next = $(this).next().get(0);
             var prev = $(this).prev().get(0);

             var keys = { startkey: [db, start] };
             keys.endkey = next ? [db, next.rel] : [db, {}];
             
             var opts = {
               success: function(logs){
                 new Highcharts.Chart($.extend(chart_options, {
                   series: [
                     {name: 'źródło danych', type: 'scatter', data: logs.rows.map(function(log){ return log.value && log.value.remote ? (log.value.remote < 1000 ? log.value.remote : 1000) : 0 }).filter(function(_, i){
                       return true
                     })},
                     {name: 'baza danych', type: 'scatter', data: logs.rows.map(function(log){ return log.value && log.value.db ? log.value.db : 0 }).filter(function(_, i){
                       return true
                     }), color: '#BA1E16'}
                   ]
                 }));
                 return false
               }
             };
             app.view('recent-items', $.extend(opts, keys));

             // Date
             var days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
             var months = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"]
             $('#date').text(days[date.getDay()] +', '+ date.getDate() +' '+ months[date.getMonth()] +' '+ date.getFullYear() +' r.');
             $('#deleted_timetables').text(day.removes ? day.removes.length : 0);

             // Errors table
             app.view('status-code', $.extend({
               group: false,
               success: function(result){
                 $('#status').find('tr:not(:has(th))').remove();
                 $.each(result.rows[0].value, function(code, count){
                   var tr = $('<tr \>')
                       .append($('<td \>').text('#'+ code))
                       .append($('<td \>').text(count));
                   $('#status').append(tr);
                 })
               }
             }, keys));

             // Lines count
             app.view('lines', $.extend({
               group: false,
               success: function(result){
                 $('#lines').text(result.rows.length ? result.rows[0].value : 0)
               }
             }, keys));

             //New timetables
             app.view('new-timetables', $.extend({
               group: false,
               success: function(result){
                 $('#new_timetables').text(result.rows.length ? result.rows[0].value : 0)
               }
             }, keys))

             app.view('timetables', $.extend({
               group: false,
               success: function(result){
                 $('#all_timetables').text(result.rows.length ? result.rows[0].value : 0)
               }
             }, keys));
          })
          div.prepend(link);
          past.scrollLeft(past.width());
        })
        $(past.children().get(-1)).click()
      }
    })
  })
  select.trigger('change');
})
