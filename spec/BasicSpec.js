var sys = require('sys')
var jsdom = require('jsdom');
var Pigeons = require('pigeons').Client;
var config = {
  home: '',
  get: {
    expiration: [],
    context: 'div',
    days: '.day',
    hours: '.hour',
    minutes: '.minute'
  }
};
var createDocument = function(body){
  return '<html><head></head><body>'+ body +'</body></html>'
};

describe('parser', function(){

  it('should read tree vertically', function(){
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
    var html = createDocument(body);
    var window = jsdom.jsdom(html).createWindow();

    expect((new Pigeons(config)).parseTimetable(window).table).toEqual({
      first:  {4: ['01'], 7: ['04']},
      second: {5: ['02'], 8: ['05']},
      third:  {6: ['03'], 9: ['06']}
    })
  })
  it('should read tree horizontally', function(){
    var body = "                    \
      <div class='day'>first</div>  \
      <div class='hour'>4</div>     \
      <div class='minute'>01</div>  \
      <div class='hour'>7</div>     \
      <div class='minute'>04</div>  \
      <div class='day'>second</div> \
      <div class='hour'>5</div>     \
      <div class='minute'>02</div>  \
      <div class='hour'>8</div>     \
      <div class='minute'>05</div>  \
      <div class='day'>third</div>  \
      <div class='hour'>6</div>     \
      <div class='minute'>03</div>  \
      <div class='hour'>9</div>     \
      <div class='minute'>06</div>";
    var html = createDocument(body);
    var window = jsdom.jsdom(html).createWindow();

    expect((new Pigeons(config)).parseTimetable(window).table).toEqual({
      first:  {4: ['01'], 7: ['04']},
      second: {5: ['02'], 8: ['05']},
      third:  {6: ['03'], 9: ['06']}
    })
  })
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
    var html = createDocument(body);
    var window = jsdom.jsdom(html).createWindow();

    expect((new Pigeons(config)).parseTimetable(window).table).toEqual({
      first:  {4: ['01'], 7: ['04']},
      second: {5: ['02'], 8: ['05']},
      third:  {6: ['03'], 9: ['06']}
    })
  })
})
