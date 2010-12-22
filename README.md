Pigeons
=======

Pigeons are flying (web)rats which live in every major city. Their job is to watch closely every bus stop (and tram stop for that matter) and report back any changes in timetables to the headquarter.

Features
--------

* Compatibility with every major public transport comapny's website in Poland.
* Configuration files for 10 biggest cities in Poland.

Installation
------------

    $ npm install pigeons

or

    $ git clone https://github.com/stanley/pigeons
    $ cd pigeons
    $ git submodule init
    $ git submodule update
    $ npm link .

Usage
-----

    var Client = require('pigeons').Client,
        config = {};

    var mpk = new Client(config);
    mpk.getAll();

TODO
----

* Monitor, show progress.
* Remove CouchDB dependency.

Want some more?
---------------

Check out [Bagatela](https://github.com/stanley/bagatela) - polish public transport RESTfull API.

License
-------

Copyright (c) 2010 Stanisław Wasiutyński

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
