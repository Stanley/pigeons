Pigeons
=======

Pigeons are flying (web)rats which live in every major city. Their job is
to watch closely every bus stop (or tram stop for that matter) and report
back any changes in timetables to the headquarter.

Features
--------

* Compatibility with every major public transport company's website in
Poland.
* It's live on my server. Visit <http://api.bagate.la/_utils> to access all
the data pigeons have been gathering for some time now.

Installation
------------

    $ npm install pigeons

Testing
-------

    $ node specs.js

Usage
-----

To get data from any source:

    var Pigeons = require('pigeons'),
        config = { ... }; // See Configuration section below

    new Pigeons(config, function(){
      // This function is called after logs database has been created.
      this.getAll(function(){
        // This function is called after all timetables have been
        // downloaded, parsed and saved to the database.
      });
    });

There is also a couchapp which displays logs. Works only if you enable
logging to couchdb. To generate couchapp type:

    $ couchapp push couch/app.js http://localhost:5984/pigeons

Since it uses couchapp module, you might have to install it (`npm install
couchapp`).

Configuration
-------------

In order to read any type of timetables from almost any source, you need to
provide a few lines of configuration. That is CSS selectors of some key
elements on pages we will traverse. Visit <https://gist.github.com/887597>
to see some examples.

CAUTION
-------

API might change in the future.

Want some more?
---------------

Check out [Bagatela](https://github.com/stanley/bagatela) - Polish public
transport RESTful search API.

License
-------

Copyright (c) 2010 Stanisław Wasiutyński

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
