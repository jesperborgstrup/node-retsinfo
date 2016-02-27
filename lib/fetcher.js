var request = require('request');
var htmlparser = require('htmlparser');
var select = require('soupselect').select;
var Entities = require('html-entities').AllHtmlEntities;;
var _ = require('lodash');

var constants = require('./constants');

var entities = new Entities();

const FORM_NEWEST_LAWS = "R0210.aspx";

const FORM_MINISTRIES = "R0300.aspx";
const FORM_MINISTRY = "R0310.aspx";

const DEFAULT_OPTIONS = {
  baseUrl: 'https://www.retsinformation.dk',
  containerCssPath: 'html body form#aspnetForm div.divCon1 div.divCon2 div.divCon3 div.divCon4'
};

function Fetcher(options) {
  this.options = _.defaultsDeep(options, DEFAULT_OPTIONS);
}

/**
 * Returns the body box box of a form, removing header, footer, etc
 *
 * As of this writing, the element is placed under the following path:
 * "html body form#aspnetForm div.divCon1 div.divCon2 div.divCon3 div.divCon4"
 * The box is then the child "div.bodyBox"
 *
 * @params {array} dom The list representing the DOM
 * @params {function} done function(err, bodyBox)
 */
Fetcher.prototype._extractBodyBox = function(dom, done) {
  // Find body box
  var bodyBoxes = select(dom, 'div.bodyBox');
  if ( bodyBoxes.length !== 1 ) {
    return done(new Error('Expected 1 body box. Found ' + bodyBoxes.length + ' body boxes'));
  }

  var bodyBox = bodyBoxes[0];

  done(null, bodyBox);
}

/**
 * Uses htmlparser to parse html into a DOM structure, returns the <html> object
 *
 * @params {string} html
 * @params {function} done
 */
Fetcher.prototype._parseHtmlForm = function(html, done) {
  var parserHandler = new htmlparser.DefaultHandler(function(err, dom) {
    if (err) {
      return done(err);
    }

    // Find <html> object
    var htmlObjects = dom.filter(function(obj) { return obj.type === 'tag' && obj.name === 'html'; } );
    if ( htmlObjects.length !== 1 ) {
      return done(new Error('Expected 1 <html> object. Found ' + htmlObjects.length));
    }

    // Return <html> object
    return done(null, dom);
  });
  var parser = new htmlparser.Parser(parserHandler);
  parser.parseComplete(html);
}

/**
 * Fetches the body box box on the HTML page for a specific form
 *
 * @param {string} form Which Retsinformation form to fetch (e.g. 'R0310.aspx')
 * @param {object} query Object with query arguments to send with the HTTP request
 * @param {function} done Callback(err, bodyBox)
 */
Fetcher.prototype._fetchBodyBox = function _fetchBodyBox(form, query, done) {
  var self = this;

  var formUrl = this.options.baseUrl + '/Forms/' + form;
  request.get(formUrl, { qs: query }, function(err, httpResponse, body) {
    if (err) {
      return done(err);
    }

    self._parseHtmlForm(body, function(err, dom) {
      if (err) {
        return done(err);
      }

      self._extractBodyBox(dom, done);
    });
  });
};

/**
 * Retrieves a list of ministries as listed on retsinformation.dk.
 *
 * The ministry list is in the body box with the following path:
 * "div.wrapper1 div.wrapper2 div#ctl00_MainContent_RessortList1.listFilter ul"
 *
 * Alternatively, there is an (unuused) <select> with the following path in the side box
 * "div#ctl00_SubMenuContent_RessortPicker1.bottomBox div.wrapper1 div.wrapper2 div.content select#ctl00_SubMenuContent_ctl01.ddl.ddl1"
 *
 * @param {function} done Callback(err, ministries)
 */
Fetcher.prototype._listMinistries = function _listMinistries(done) {
  this._fetchBodyBox(FORM_MINISTRIES, {}, function(err, bodyBox) {
    if (err) {
      return done(err);
    }

    var links = select(bodyBox, 'div.listFilter ul li a')

    // Prepare regex patterns for extracting res (ministry ID) from hyperlink
    var resHrefPattern = new RegExp(/res=(\d+)/);

    // Map the <li>s to {id, name} objects
    var ministries = {};
    links.forEach(function(link) {
      var id = link.attribs.href.match(resHrefPattern)[1];

      ministries[id] = {
        id: id,
        name: entities.decode( link.children[0].data.trim() )
      };
    });

    // Return result
    done(null, ministries);
  });
};

/**
 * Retrieves basic information about a ministry from retsinformation.dk
 *
 * The numbers of documents are in <li>'s inside two <ul>'s inside the body box:
 * "div.wrapper1 div.wrapper2 div#ctl00_MainContent_NavigationRessortList1.topText div.listFilter ul"
 * Each <li> then has a hyperlink to the documents followed by a text "<document type> (<count>)",
 * optionally followed by an <img> of an exclamation mark
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {function} done Callback(err, ministries)
 */
Fetcher.prototype._getMinistryInfo = function _getMinistryInfo(ministryId, done) {
  this._fetchBodyBox(FORM_MINISTRY, {res: ministryId}, function(err, bodyBox) {
    if (err) {
      return done(err);
    }

    // topText holds both the name and the list items
    var topText = select(bodyBox, 'div.topText');
    var ministryNameItems = select(topText, 'div.hdr h2');
    var listItems = select(topText, 'div.listFilter ul li');

    // Check that we have the elements that we need
    if ( !ministryNameItems.length || ! ministryNameItems[0].children.length || ! listItems.length ) {
      return done(new Error('Invalid ministry ID ' + ministryId));
    }

    // Extract ministry name from inside the <h2>
    var ministryName = entities.decode( ministryNameItems[0].children[0].data.trim() );

    // Prepare regex patterns for extracting nres (document type) from hyperlink and for extracting document name and count
    var nresHrefPattern = new RegExp(/nres=(\d+)/);
    var nameCountPattern = new RegExp(/^(.*)\((\d+)\)\s*$/);

    // Map each list item to a {type, name, count} object
    var documents = {};
    listItems.forEach(function(li) {
      var link = select(li, 'a')[0];
      var text = link.children[0];

      var nres = link.attribs.href.match(nresHrefPattern)[1];
      var type = parseInt( nres );
      var nameAndCount = text.data.match(nameCountPattern);

      documents[type] = {
        type: type,
        name: entities.decode( nameAndCount[1].trim() ),
        count: parseInt( nameAndCount[2] )
      };
    });

    // Prepare result
    var result = {
      id: ministryId,
      name: ministryName,
      documents: documents
    }

    // Return
    done(null, result);
  });
};

/**
 * Retrieves a list of documents of a specific type from a specific ministry
 *
 * Each document can be found as a tr.row or tr.altRow in the body box under the path:
 * "div.wrapper1 div.wrapper2 div#ctl00_MainContent_NavigationRessortList1.topText table#ctl00_MainContent_ResultGrid1.tbl.tbl2 tbody"
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {integer} documentType Document type (1-6)
 * @param {integer} limit Maximum number of documents to list
 * @param {function} done Callback(err, documents)
 */
Fetcher.prototype._listMinistryDocuments = function _listMinistryDocuments(ministryId, documentType, limit, done) {
  this._fetchBodyBox(FORM_MINISTRY, {res: ministryId, nres: documentType}, function(err, bodyBox) {
    if (err) {
      return done(err);
    }

    var rows = select(bodyBox, 'table.tbl tr');

    // Remove the row with class="th"
    rows = rows.filter(function(row) { return row.attribs.class.match(/\brow\b/) || row.attribs.class.match(/\baltRow\b/); } );

    // Prepare regex patterns for extracting id (document ID) from hyperlink and for converting date
    var idHrefPattern = new RegExp(/id=(\d+)/);
    var datePattern = new RegExp(/^(\d{2})-(\d{2})-(\d{4})$/);

    var documents = rows.map(function(row) {
      // Get <a> elements inside <td> cells
      var links = select(row.children, 'td a');

      // Find the ID from the first column, the name from the second column, and the date in the third column
      var id = parseInt( links[0].data.match(idHrefPattern)[1] );

      var name = entities.decode( links[1].children[0].data.trim() );

      // Convert e.g. "24-04-1996" to a real Date object
      var dateString = links[2].children[0].data.trim();
      var dateMatch = dateString.match(datePattern);
      var date = new Date(Date.UTC( dateMatch[3], dateMatch[2], dateMatch[1] ));

      return {
        id: id,
        name: name,
        date: date
      };
    });

    done(null, documents);
  });
}


/**
 * Retrieves a list of ministries as listed on retsinformation.dk
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {function} done Callback(err, ministries)
 */
Fetcher.prototype.listMinistries = function listMinistries(done) {
  this._listMinistries(done);
};

/**
 * Retrieves basic information about a ministry from retsinformation.dk
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {function} done Callback(err, ministries)
 */
Fetcher.prototype.getMinistryInfo = function getMinistryInfo(ministryId, done) {
  this._getMinistryInfo(ministryId, done);
};

/**
 * Retrieves a list of documents of a specific type from a specific ministry
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {integer} documentType Document type (1-6)
 * @param {integer} limit Maximum number of documents to list
 * @param {function} done Callback(err, documents)
 */
Fetcher.prototype.listMinistryDocuments = function listMinistryDocuments(ministryId, documentType, limit, done) {
  this._listMinistryDocuments(ministryId, documentType, limit, done);
}

module.exports = Fetcher;
