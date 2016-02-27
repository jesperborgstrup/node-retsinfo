var Fetcher = require('./lib/fetcher');

module.exports = {
  Fetcher: Fetcher
};

var fetcher = new Fetcher({a: 'ext'});

fetcher.getMinistryInfo(12, function(err, info) {
  if ( err ) return console.error( err );

  console.log(info)
});

