var Fetcher = require('./lib/fetcher');

module.exports = {
  Fetcher: Fetcher
};

var fetcher = new Fetcher({a: 'ext'});

fetcher.listMinistries(function(err, info) {
  if ( err ) return console.error( err );

  console.log(JSON.stringify(info));
});

