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
 * Returns the body box and side box of a form, removing header, footer, etc
 *
 * As of this writing, both elements are placed under the following path:
 * "html body form#aspnetForm div.divCon1 div.divCon2 div.divCon3 div.divCon4"
 * The boxes are then the children "div.bodyBox" and "div.sideBox"
 *
 * @params {array} dom The list representing the DOM
 * @params {function} done function(err, bodyBox, sideBox)
 */
Fetcher.prototype._extractBodyAndSideBox = function(dom, done) {
  // Find side box and body box
  var bodyBoxes = select(dom, 'div.bodyBox');
  var sideBoxes = select(dom, 'div.sideBox');
  if ( sideBoxes.length !== 1 || bodyBoxes.length !== 1 ) {
    return done(new Error('Expected 1 side box and 1 body box. Found ' + sideBoxes.length + ' side boxes, ' + bodyBoxes.length + ' body boxes'));
  }

  var bodyBox = bodyBoxes[0];
  var sideBox = sideBoxes[0];

  done(null, bodyBox, sideBox);
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
 * Fetches the body box and side box on the HTML page for a specific form
 *
 * @param {string} form Which Retsinformation form to fetch (e.g. 'R0310.aspx')
 * @param {object} query Object with query arguments to send with the HTTP request
 * @param {function} done Callback(err, bodyBox, sideBox)
 */
Fetcher.prototype._fetchBodyAndSideBox = function _fetchBodyAndSideBox(form, query, done) {
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

      self._extractBodyAndSideBox(dom, done);
    });
  });
};

/**
 * Retrieves a list of ministries as listed on retsinformation.dk.
 *
 * The <select> has the following path under the side box
 * "div#ctl00_SubMenuContent_RessortPicker1.bottomBox div.wrapper1 div.wrapper2 div.content select#ctl00_SubMenuContent_ctl01.ddl.ddl1"
 *
 * @param {function} done Callback(err, ministries)
 */
Fetcher.prototype._listMinistries = function _listMinistries(done) {
  this._fetchBodyAndSideBox(FORM_MINISTRIES, {}, function(err, bodyBox, sideBox) {
    if (err) {
      return done(err);
    }

    var options = select(sideBox, 'select.ddl option')

    // Filter out options without a value or without text
    var ministryOptions = options.filter(function(option) { return option.attribs && option.attribs.value && option.children; } );

    // Map the <option>s to {id, name} objects
    var ministries = ministryOptions.map(function(option) { return {id: option.attribs.value, name: entities.decode( option.children[0].data ) }; } );

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
  this._fetchBodyAndSideBox(FORM_MINISTRY, {res: ministryId}, function(err, bodyBox) {
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
    done(result);
  });
};

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

Fetcher.prototype.fetchNewestLaws = function fetchNewestLaws(done) {
  done(null, {the:'result'});
};

module.exports = Fetcher;
