var fs = require('fs');

var sinon = require('sinon'),
    mockery = require('mockery'),
    should = require('chai').should();

describe('Fetcher', function() {
  var Fetcher, fetcher;
  var requestStub;

  /*
   * MOCKERY
   */
  before(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    requestStub = {
      get: sinon.stub()
    };

    mockery.registerMock('request', requestStub);
    Fetcher = require('../../lib/fetcher');
    fetcher = new Fetcher();
  });

  after(function() {
    mockery.disable();
  });


  /*
   * _fetchBodyBox
   */
  describe('_fetchBodyBox', function() {

    it('can fetch body and side box from example R0300 page', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0300.html'));

      fetcher._fetchBodyBox('R0300.aspx', {}, function(err, bodyBox) {
        if (err) {
          return done(err);
        }

        bodyBox.attribs.class.should.match(/\bbodyBox\b/);

        done();
      });
    });

    it('returns error when retrieving an invalid HTML document', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/ft.dk.html'));

      fetcher._fetchBodyBox('whatever', {}, function(err, bodyBox) {
        if ( ! err) {
          return done(Error('Expected an error'));
        }

        done();
      });

    })

  });

  /*
   * listMinistries
   */
  describe('listMinistries (R0300)', function() {

    it('can list ministries', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0300.html'));
      var expectedMinistriesList = {"1":{"id":"1","name":"Justitsministeriet"},"5":{"id":"5","name":"Finansministeriet"},"7":{"id":"7","name":"Forsvarsministeriet"},"8":{"id":"8","name":"Fødevareministeriet"},"11":{"id":"11","name":"Kulturministeriet"},"12":{"id":"12","name":"Miljøministeriet"},"14":{"id":"14","name":"Skatteministeriet"},"16":{"id":"16","name":"Statsministeriet"},"19":{"id":"19","name":"Udenrigsministeriet"},"20":{"id":"20","name":"Undervisningsministeriet"},"23":{"id":"23","name":"Folketinget"},"30":{"id":"30","name":"Beskæftigelsesministeriet"},"122":{"id":"122","name":"Ministeriet for Sundhed og Forebyggelse"},"123":{"id":"123","name":"Transportministeriet"},"126":{"id":"126","name":"Erhvervs- og Vækstministeriet"},"129":{"id":"129","name":"Klima-, Energi- og Bygningsministeriet"},"131":{"id":"131","name":"Ministeriet for By, Bolig og Landdistrikter"},"132":{"id":"132","name":"Økonomi- og Indenrigsministeriet"},"141":{"id":"141","name":"Kirkeministeriet"},"142":{"id":"142","name":"Uddannelses- og Forskningsministeriet"},"143":{"id":"143","name":"Ministeriet for Børn, Ligestilling, Integration og Sociale Forhold"},"152":{"id":"152","name":"Udlændinge-, Integrations- og Boligministeriet"},"153":{"id":"153","name":"Transport- og Bygningsministeriet"},"154":{"id":"154","name":"Energi-, Forsynings- og Klimaministeriet"},"155":{"id":"155","name":"Social- og Indenrigsministeriet"},"156":{"id":"156","name":"Miljø- og Fødevareministeriet"},"157":{"id":"157","name":"Sundheds- og Ældreministeriet"},"158":{"id":"158","name":"Ministeriet for Børn, Undervisning og Ligestilling"}};

      fetcher.listMinistries(function(err, ministries) {
        if (err) {
          return done(err);
        }

        ministries.should.deep.equal(expectedMinistriesList);

        done();
      })
    })

  });

  /*
   * getMinistryInfo
   */
  describe('getMinistryInfo (R0310, Miljøministeriet)', function() {

    it('can get ministry info', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0310-12.html'));
      var expectedMinistryInfo = {"id":12,"name":"Miljøministeriet","documents":{"1":{"type":1,"name":"Love/Lovbekendtgørelser","count":25},"2":{"type":2,"name":"Bekendtgørelser m.v.","count":417},"3":{"type":3,"name":"Cirkulærer, vejledninger m.v.","count":267},"4":{"type":4,"name":"Afgørelser","count":98},"5":{"type":5,"name":"Lovforslag i nuværende Folketingssamling","count":0},"6":{"type":6,"name":"Seneste dokumenter","count":0}}};

      // (ministryId, done)
      fetcher.getMinistryInfo(12, function(err, info) {
        if (err) {
          return done(err);
        }

        info.should.deep.equal(expectedMinistryInfo);

        done();
      });

    });

  });

  /*
   * listMinistryDocuments
   */
  describe('listMinistryInfo (R0310, Miljøministeriet, Love/Lovbekendtgørelser)', function() {

    it('can list ministry documents', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0310-12-1.html'));
      var expectedMinistryDocuments = [{"id":168143,"name":"Lov om Miljøteknologisk Udviklings- og Demonstrationsprogram","date":new Date("2015-03-10T00:00:00.000Z")},{"id":167279,"name":"Lov om Den Danske Naturfond","date":new Date("2015-01-27T00:00:00.000Z")},{"id":164026,"name":"Bekendtgørelse af lov om kemikalier","date":new Date("2014-07-24T00:00:00.000Z")},{"id":161126,"name":"Lov om vandplanlægning","date":new Date("2014-01-26T00:00:00.000Z")},{"id":146562,"name":"Bekendtgørelse af lov om Geodatastyrelsen","date":new Date("2013-11-09T00:00:00.000Z")},{"id":143896,"name":"Bekendtgørelse af lov om udstykning og anden registrering i matriklen","date":new Date("2013-11-07T00:00:00.000Z")},{"id":158136,"name":"Bekendtgørelse af lov om afgift ved udstykning m.m.","date":new Date("2013-11-07T00:00:00.000Z")},{"id":144267,"name":"Bekendtgørelse af lov om sommerhuse og campering m.v.","date":new Date("2013-08-03T00:00:00.000Z")},{"id":146610,"name":"Bekendtgørelse af lov om landinspektørvirksomhed","date":new Date("2013-07-17T00:00:00.000Z")},{"id":144940,"name":"Lov om udbyttedeling ved anvendelse af genetiske ressourcer","date":new Date("2013-01-23T00:00:00.000Z")},{"id":144423,"name":"Lov om administration af Den Europæiske Unions forordninger om handel med træ og træprodukter med henblik på bekæmpelse af handel med ulovligt fældet træ","date":new Date("2013-01-18T00:00:00.000Z")},{"id":132106,"name":"Bekendtgørelse af lov om kommuners afståelse af vandforsyninger og spildevandsforsyninger","date":new Date("2010-07-07T00:00:00.000Z")},{"id":131457,"name":"Bekendtgørelse af lov om betalingsregler for spildevandsforsyningsselskaber m.v.","date":new Date("2010-07-07T00:00:00.000Z")},{"id":130840,"name":"Lov om udstykning og salg af visse sommerhusgrunde tilhørende staten","date":new Date("2010-04-23T00:00:00.000Z")},{"id":125346,"name":"Lov om vandsektorens organisering og økonomiske forhold","date":new Date("2009-07-12T00:00:00.000Z")},{"id":122571,"name":"Lov om infrastruktur for geografisk information","date":new Date("2009-01-19T00:00:00.000Z")},{"id":13143,"name":"Bekendtgørelse af lov om anvendelse af Frøstruplejren","date":new Date("2007-07-21T00:00:00.000Z")},{"id":13142,"name":"Bekendtgørelse af lov om kolonihaver","date":new Date("2007-07-21T00:00:00.000Z")},{"id":13140,"name":"Bekendtgørelse af Lov om Domaineeiendommes Afhændelse","date":new Date("2007-07-21T00:00:00.000Z")},{"id":12565,"name":"Lov om ophævelse af lov om Den Grønne Fond, lov om pulje til grøn beskæftigelse, lov om støtte til forureningstruede vandindvindinger og om ændring af lov om beskyttelse af havmiljøet og lov om Ørestaden m.v.","date":new Date("2002-07-06T00:00:00.000Z")},{"id":81231,"name":"Lov om ophævelse af lov af 30. januar 1861 angående farten på Gudenå mellem Silkeborg og Randers","date":new Date("1996-05-24T00:00:00.000Z")},{"id":55284,"name":"Lov om ophævelse af lov om stempelafgift af topografiske kort","date":new Date("1991-05-10T00:00:00.000Z")},{"id":49297,"name":"Lov om en saltvandssø i Margrethe Kog","date":new Date("1983-04-02T00:00:00.000Z")},{"id":55315,"name":"Lov angaaende Geodætisk Instituts trigonometriske Stationer m.v. (* 1)","date":new Date("1932-01-16T00:00:00.000Z")},{"id":12301,"name":"Lov om Udnyttelse af Vandkraften i offentlige Vandløb ved Anlæg af Elektricitetsværker","date":new Date("1918-06-25T00:00:00.000Z")}];

      // (ministryId, documentType, limit, done)
      fetcher.listMinistryDocuments(12, 1, 25, function(err, documents) {
        if (err) {
          return done(err);
        }

        documents.should.deep.equal(expectedMinistryDocuments);

        done();
      });

    });

  });


});
