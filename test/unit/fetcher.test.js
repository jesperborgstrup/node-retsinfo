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

  describe('Internals', function() {
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

    describe('_parseDocumentMinistryAndDateString', function() {

      it('can parse the string "Sundheds- og Ældreministeriet, den 15. februar 2016"', function(done) {
        var result = fetcher._parseDocumentMinistryAndDateString('Sundheds- og Ældreministeriet, den 15. februar 2016');

        // List with two elements, ministry and Date object
        result.length.should.equal(2);
        result[0].should.equal('Sundheds- og Ældreministeriet');
        result[1].getTime().should.equal(new Date('2016-02-15').getTime());

        done();
      });

    });

  });


  /*
   * listMinistries
   */
  describe('listMinistries', function() {

    it('can list ministries (R0300)', function(done) {
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
  describe('getMinistryInfo', function() {

    it('can get ministry info (R0310, Miljøministeriet)', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0310-12.html'));
      var expectedMinistryInfo = {"id":12,"name":"Miljøministeriet","documentTypes":{"1":{"id":1,"name":"Love/Lovbekendtgørelser","count":25},"2":{"id":2,"name":"Bekendtgørelser m.v.","count":417},"3":{"id":3,"name":"Cirkulærer, vejledninger m.v.","count":267},"4":{"id":4,"name":"Afgørelser","count":98},"5":{"id":5,"name":"Lovforslag i nuværende Folketingssamling","count":0},"6":{"id":6,"name":"Seneste dokumenter","count":0}}};

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
  describe('listMinistryInfo', function() {

    it('can list ministry documents (R0310, Miljøministeriet, Love/Lovbekendtgørelser)', function(done) {
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

  describe('getDocument', function() {
    it('can parse a document (164746, Bekendtgørelse af lov om forældelse af fordringer, Justitsministeriet)', function(done) {
      requestStub.get.yields(null, null, fs.readFileSync('test/html-examples/R0710-164746.html'));

      // (documentId, done)
      fetcher.getDocument(164746, function(err, document) {
        if (err) {
          return done(err);
        }

        document.title.should.equal('Bekendtgørelse af lov om forældelse af fordringer (forældelsesloven)');
        document.preamble.should.equal('Herved bekendtgøres lov om forældelse af fordringer (forældelsesloven), jf. lovbekendtgørelse nr. 1063 af 28. august 2013, med de ændringer, der følger af lov nr. 1622 af 26. december 2013 og § 5 i lov nr. 1500 af 23. december 2014.');
        document.signer.should.equal('Søren Pind');
        document.extraSigners.should.deep.equal(['Mette Johansen']);
        document.ministryName.should.equal('Justitsministeriet');
        document.date.getTime().should.equal(new Date('2015-11-09').getTime())

        document.chapters.length.should.equal(9);

        document.chapters[0].sections.length.should.equal(1);
        document.chapters[1].sections.length.should.equal(2);
        document.chapters[2].sections.length.should.equal(1);
        document.chapters[3].sections.length.should.equal(11);
        document.chapters[4].sections.length.should.equal(5);
        document.chapters[5].sections.length.should.equal(3);
        document.chapters[6].sections.length.should.equal(3);
        document.chapters[7].sections.length.should.equal(3);
        document.chapters[8].sections.length.should.equal(3);

        document.chapters[0].sections[0].no.should.equal('1');
        document.chapters[0].sections[0].text.should.equal('Fordringer på penge eller andre ydelser forældes efter reglerne i denne lov, medmindre andet følger af særlige bestemmelser om forældelse i anden lov.');
        document.chapters[0].sections[0].paragraphs.length.should.equal(0);

        document.chapters[1].sections[0].no.should.equal('2');
        document.chapters[1].sections[0].text.should.equal('Forældelsesfristerne regnes fra det tidligste tidspunkt, til hvilket fordringshaveren kunne kræve at få fordringen opfyldt, medmindre andet følger af andre bestemmelser.');
        document.chapters[1].sections[0].paragraphs.length.should.equal(4);

        document.chapters[1].sections[1].no.should.equal('2 a');
        document.chapters[1].sections[1].text.should.equal('For fordringer, som støttes på skriftlig aftale om indskud i et selskab, regnes forældelsesfristen tidligst fra det tidspunkt, hvor selskabet beslutter at indkalde indskuddet. Uanset 1. pkt. regnes forældelsesfristen dog senest fra 10 år efter begyndelsestidspunktet i henhold til § 2.');
        document.chapters[1].sections[1].paragraphs.length.should.equal(0);

        document.chapters[8].sections[2].no.should.equal('31');
        document.chapters[8].sections[2].text.should.equal('Loven gælder ikke for Færøerne og Grønland, men kan ved kongelig anordning sættes i kraft for disse landsdele med de afvigelser, som de særlige færøske og grønlandske forhold tilsiger.');
        document.chapters[8].sections[2].paragraphs.length.should.equal(0);

        document.commencements.length.should.equal(5);

        document.commencements[0].text.should.equal('Lov nr. 1336 af 19. december 2008 (Konsekvensændringer som følge af lov om inddrivelse af gæld til det offentlige) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:');
        document.commencements[0].sections.length.should.equal(1);
        document.commencements[0].sections[0].paragraphs.length.should.equal(2);

        document.commencements[0].sections[0].paragraphs[0].text.should.equal('Loven træder i kraft den 1. januar 2009, jf. dog stk. 2. § 11 finder alene anvendelse på afgørelser om lønindeholdelse, der træffes efter lovens ikrafttræden.');
        document.commencements[0].sections[0].paragraphs[1].text.should.equal('(Udelades)');

        document.footnotes.length.should.equal(7);

        done();
      });

    });
  });


});
