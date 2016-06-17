var express = require('express'),
    request = require('request'),
    url = require('url');

var app = express();

app.use(express.static('.'));

app.get('/proxy*', function(req, res) {
  var proxied = 'http://localhost:9888' + req.url.replace('/proxy', '');

  console.log('proxied', proxied);

  request.get(proxied).pipe(res);
});

app.listen(8888);