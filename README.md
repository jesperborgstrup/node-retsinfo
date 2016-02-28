# node-retsinfo

A Node package to scrape legal documents from retsinformation.dk

_Note_: There are some document types that are not yet supported, and will simply crash the program. Pull requests are welcome.

## Installation

```
npm install retsinfo
```

## Usage

```javascript
var Fetcher = require('retsinfo').Fetcher;
var fetcher = new Fetcher();

// Get a list of ministries
fetcher.listMinistries(function(err, ministries) {
  if ( err ) return console.error( err );

  // Each element of ministries is an object with the properties id and name
  console.log(ministries);

  // '7' is Forsvarsministeriet: { id: '7', name: 'Forsvarsministeriet' }
  var ministry = ministries['7'];

  // Retrieve further information about a ministry
  fetcher.getMinistryInfo(ministry.id, function(err, info) {
    if ( err ) return console.error( err );

    // info is an object with properties id, name, and documentTypes.
    // documentTypes is an object where keys are document type IDs,
    // and values are objects with properties id, name and count
    console.log();
    console.log(info);

    // '1': { id: 1, name: 'Love/Lovbekendtgørelser', count: 25 }
    var documentType = info.documentTypes['1'];

    // Retrieve a list of documents with the given type from the given ministry
    fetcher.listMinistryDocuments(ministry.id, documentType.id, function(err, documents) {
      if ( err ) return console.error( err );

      // Each element in documents is an object with id, name and date
      // {
      //   id: 176852,
      //   name: 'Bekendtgørelse af lov om Forsvarets Efterretningstjeneste (FE)',
      //   date: Thu Feb 04 2016 01:00:00 GMT+0100 (CET)
      // }
      console.log();
      console.log(documents);


      fetcher.getDocument(164746, function(err, document) {
        if (err) return console.error(err);

        console.log();
        console.log(document);
      })
    });
  })
});
```

The `getDocument(164746, callback)` function returns a JavaScript object like the following:

```
{ title: 'Bekendtgørelse af lov om forældelse af fordringer (forældelsesloven)',
  preamble: 'Herved bekendtgøres lov om forældelse af fordringer (forældelsesloven), jf. lovbekendtgørelse nr. 1063 af 28. august 2013, med de ændringer, der følger af lov nr. 1622 af 26. december 2013 og § 5 i lov nr. 1500 af 23. december 2014.',
  signer: 'Søren Pind',
  extraSigners: [ 'Mette Johansen' ],
  ministryName: 'Justitsministeriet',
  date: Mon Nov 09 2015 01:00:00 GMT+0100 (CET),
  chapters:
   [ { id: 'id74dcab74-f6b1-4417-8ce2-61e75d172b62',
       no: '1',
       title: 'Lovens område',
       sections: [Object] },
     { id: 'id53a1a7d2-ce45-4d6d-bf1f-cb2ef077c6b4',
       no: '2',
       title: 'Forældelsesfristernes begyndelsestidspunkt',
       sections: [Object] },
     { id: 'ida60e69ec-3084-4cb3-b3ee-8845b15dc5af',
       no: '3',
       title: 'De almindelige forældelsesfrister',
       sections: [Object] },
     { id: 'id0d7b77b8-e08a-41e7-8bed-35fe10724699',
       no: '4',
       title: 'Særlige forældelsesfrister og tillægsfrister',
       sections: [Object] },
     { id: 'idbe59b667-7c5f-41e5-8397-9524e675870f',
       no: '5',
       title: 'Afbrydelse af forældelse',
       sections: [Object] },
     { id: 'id09069f38-9f90-444a-9f23-6a3d55df5792',
       no: '6',
       title: 'Foreløbig afbrydelse af forældelse',
       sections: [Object] },
     { id: 'id3fd36dde-ebaf-4836-bbd2-9d74ea5d34db',
       no: '7',
       title: 'Virkningerne af forældelse',
       sections: [Object] },
     { id: 'id2e6f136f-b6a8-436b-950d-486278d93862',
       no: '8',
       title: 'Lovens fravigelighed m.v.',
       sections: [Object] },
     { id: 'idf3849790-1106-4ee2-87ae-718ec7e4083e',
       no: '9',
       title: 'Ikrafttræden m.v.',
       sections: [Object] } ],
  commencements:
   [ { text: 'Lov nr. 1336 af 19. december 2008 (Konsekvensændringer som følge af lov om inddrivelse af gæld til det offentlige) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:',
       sections: [Object] },
     { text: 'Lov nr. 718 af 25. juni 2010 (Rekonstruktion m.v.) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:',
       sections: [Object] },
     { text: 'Lov nr. 421 af 10. maj 2011 (Forældelse af fordringer på erstatning eller godtgørelse i anledning af en erhvervssygdom) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:',
       sections: [Object] },
     { text: 'Lov nr. 1622 af 26. december 2013 (Forældelse af udestående selskabsindskud) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:',
       sections: [Object] },
     { text: 'Lov nr. 1500 af 23. december 2014 (Hurtig afslutning i visse klagesager, omkostningsgodtgørelse i retssager, dækningsrækkefølgen for underholdsbidrag, restanceforebyggelse, momsregistrering af visse virksomheder, forbedret inddrivelse af restancer til det offentlige m.v.) indeholder følgende ikrafttrædelses- og overgangsbestemmelse:',
       sections: [Object] } ],
  footnotes:
   [ 'Lovændringen vedrører § 18, stk. 4, og § 19, stk. 6, 2. pkt.',
     'Lovændringen vedrører § 17, stk. 1, nr. 1 og 3, og stk. 3, § 20, stk. 3 og stk. 4, 2. pkt.',
     'Ved bekendtgørelse nr. 208 af 15. marts 2011 er det bestemt, at loven træder i kraft den 1. april 2011.',
     'Lovændringen vedrører § 3, stk. 3, nr. 1, og stk. 4.',
     'Bekendtgørelsen i Lovtidende fandt sted den 11. maj 2011.',
     'Lovændringen vedrører § 2 a og § 3, stk. 3, nr. 2-4.',
     'Lovændringen vedrører § 18, stk. 4, og § 19, stk. 6.' ] }

```

## Test

Run `npm test`

## Licence

This piece of software is licensed under the MIT license.
