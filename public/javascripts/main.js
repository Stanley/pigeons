$(document).ready(function() {

  var past = $("#past");
  past.scrollLeft(past.width());

  $.ajax({
    type: 'GET',
    url: 'http://localhost:5984/logs/_design/Root/_view/by_age',
    dataType: 'jsonp',
    contentType: 'application/json',
    processData: false,
    success: function(json){
      console.log(json)
    }
  })
  
  chart = new Highcharts.Chart({
    chart: {
      renderTo: 'chart',
      defaultSeriesType: 'spline',
      backgroundColor: 'rgba(0,0,0,0)',
      margin: [0, 0, 0, 0],
      events: {
        load: function() {
  
          // set up the updating of the chart each second
          var series = this.series[0];
          setInterval(function() {
            var x = (new Date()).getTime(), // current time
              y = Math.random();
            series.addPoint([x, y], true, true);
          }, 1000);
        }
      }
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
      gridLineColor: '#6a9bba'
    },
    tooltip: {
      formatter: function() {
                  return '<b>'+ this.series.name +'</b><br/>'+
          Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +'<br/>'+ 
          Highcharts.numberFormat(this.y, 2);
      }
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
    series: [{
      name: 'Random data',
      data: (function() {
        // generate an array of random data
        var data = [],
          time = (new Date()).getTime(),
          i;
        for (i = -119; i <= 0; i++) {
          data.push({
            x: time + i * 1000,
            y: Math.random()
          });
        }
        return data;
      })(),
      lineWidth: 2,
      marker: {
        enabled: false
      }
    }],
    credits:{
      enabled: false
    },
    plotOptions: {
     series: {
       states: {
         hover: {
           enabled: false
         }
       }
     }
   }
  });
});
