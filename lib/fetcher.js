var _           = require('lodash');
var async       = require('async');
var Entities    = require('html-entities').AllHtmlEntities;;
var htmlparser  = require('htmlparser');
var request     = require('request');
var select      = require('soupselect').select;

var constants   = require('./constants');

var entities = new Entities();

const DEFAULT_OPTIONS = {
  baseUrl: 'https://www.retsinformation.dk',
  containerCssPath: 'html body form#aspnetForm div.divCon1 div.divCon2 div.divCon3 div.divCon4'
};

function Fetcher(options) {
  this.options = _.defaultsDeep(options, DEFAULT_OPTIONS);
}


var centeredSectionNumberPattern = new RegExp(/^§\s*(\d+)$/);
var ministryAndDateStringPattern = new RegExp(/^([^,]+),\s*den\s*(\d+)\.\s*(\w+)\s*(\d+)$/);
/**
 * Parse a string like "Sundheds- og Ældreministeriet, den 15. februar 2016" into ministry and date
 *
 * @param {string} str String to parse
 * @returns [ministry, Date object] or Error object on error.
 */
Fetcher.prototype._parseDocumentMinistryAndDateString = function _parseDocumentMinistryAndDateString(str) {
  var match = str.match(ministryAndDateStringPattern);
  if ( ! match ) {
    return new Error('Invalid string');
  }

  var ministryName = match[1];
  var date = parseInt(match[2]);
  var monthName = match[3];
  var monthAbbr = monthName.substring(0,3);
  var year = parseInt(match[4]);

  if ( !constants.DANISH_MONTH_ABBREVIATIONS[monthAbbr] ) {
    return new Error('Unknown month "' + monthName + "'");
  }

  var month = constants.DANISH_MONTH_ABBREVIATIONS[monthAbbr] - 1;

  var dateObject = new Date(Date.UTC( year, month, date ) );

  //new Date(Date.UTC( dateMatch[3], dateMatch[2], dateMatch[1] ));

  return [ministryName, dateObject];
}

/**
 * Returns the body box box of a form, removing header, footer, etc
 *
 * As of this writing, the element is placed under the following path:
 * "html body form#aspnetForm div.divCon1 div.divCon2 div.divCon3 div.divCon4"
 * The box is then the child "div.bodyBox"
 *
 * @param {array} dom The list representing the DOM
 * @param {function} done function(err, bodyBox)
 */
Fetcher.prototype._extractBodyBox = function _extractBodyBox(dom, done) {
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
 * @param {string} html
 * @param {function} done
 */
Fetcher.prototype._parseHtmlForm = function _parseHtmlForm(html, done) {
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
  var options = {};
  if ( query && !_.isEmpty(query) ) {
    options.qs = query;
  }
  request.get(formUrl, options, function(err, httpResponse, body) {
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
  this._fetchBodyBox(constants.FORM_MINISTRIES, {}, function(err, bodyBox) {
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
  this._fetchBodyBox(constants.FORM_MINISTRY, {res: ministryId}, function(err, bodyBox) {
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
    var documentTypes = {};
    listItems.forEach(function(li) {
      var link = select(li, 'a')[0];
      var text = link.children[0];

      var nres = link.attribs.href.match(nresHrefPattern)[1];
      var type = parseInt( nres );
      var nameAndCount = text.data.match(nameCountPattern);

      documentTypes[type] = {
        id: type,
        name: entities.decode( nameAndCount[1].trim() ),
        count: parseInt( nameAndCount[2] )
      };
    });

    // Prepare result
    var result = {
      id: ministryId,
      name: ministryName,
      documentTypes: documentTypes
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
 * @param {object} options Can contain 'limit' (default 0, all) and 'offset' (default 0)
 * @param {function} done Callback(err, documents)
 */
Fetcher.prototype._listMinistryDocuments = function _listMinistryDocuments(ministryId, documentType, options, done) {
  var self = this;

  var limit = options.limit || 0;
  var offset = options.offset || 0;

  // If limit is zero, fetch all documents
  limit = limit <= 0 ? Math.MAX_INT : limit;

  var currentPage = 0;

  const MAX_DOCUMENTS_PER_PAGE = 50;

  var documents = [];

  var stop = false;

  var fn = function(callback) {
    self._fetchBodyBox(constants.FORM_MINISTRY, {res: ministryId, nres: documentType, page: currentPage+1}, function(err, bodyBox) {
      if (err) {
        return callback(err);
      }

      var rows = select(bodyBox, 'table.tbl tr');

      // Remove the row with class="th" (actually, keep the rows with classes "row" and "altRow")
      rows = rows.filter(function(row) { return row.attribs.class.match(/\brow\b/) || row.attribs.class.match(/\baltRow\b/); } );

      // Prepare regex patterns for extracting id (document ID) from hyperlink and for converting date
      var idHrefPattern = new RegExp(/id=(\d+)/);
      var datePattern = new RegExp(/^(\d{2})-(\d{2})-(\d{4})$/);

      rows.forEach(function(row) {
        // If limit reached, stop
        if ( documents.length >= limit ) {
          stop = true;
          return;
        }

        // Get <a> elements inside <td> cells
        var links = select(row.children, 'td a');

        // Find the ID from the first column, the name from the second column, and the date in the third column
        var id = parseInt( links[0].data.match(idHrefPattern)[1] );

        var name = entities.decode( links[1].children[0].data.trim() );

        // Convert e.g. "24-04-1996" to a real Date object
        var dateString = links[2].children[0].data.trim();
        var dateMatch = dateString.match(datePattern);
        var date = new Date(Date.UTC( dateMatch[3], dateMatch[2], dateMatch[1] ));

        documents.push({
          id: id,
          name: name,
          date: date
        });
      });

      // If this response contained less than the maximum number of documents,
      // there are no more to fetch...
      if ( rows.length < MAX_DOCUMENTS_PER_PAGE ) {
        stop = true;
      }

      currentPage++;

      callback();
    });
  };

  var check = function() {
    return !stop;
  };

  async.doWhilst(fn, check, function(err) {
    if (err) {
      return done(err);
    }

    return done(null, documents);
  });
}


Fetcher.prototype._getDocumentElements = function _getDocumentElements(documentId, done) {
  this._fetchBodyBox(constants.FORM_DOCUMENT, {id: documentId}, function(err, bodyBox) {
    if (err) {
      return done(err);
    }

    // Find main element
    var mainDivs = select(bodyBox, 'div#ctl00_MainContent_Broedtekst1');
    if ( mainDivs.length !== 1 ) {
      return done(new Error('Expected 1 div#ctl00_MainContent_Broedtekst1, found ' + mainDivs.length) );
    };
    var mainDiv = mainDivs[0];

    // Find tags
    var tags = mainDiv.children.filter(function(el) { return el.type === 'tag'; } );

    done(null, tags);
  });
};

/**
 * Parses the elements in a document and produces a document object
 *
 * @param {array} elements
 * @param {function} done Callback(err, document)
 */
Fetcher.prototype._parseDocumentElements = function _parseDocumentElements(elements, done) {
  var self = this;

  // Prepare result
  var result = {
    title: null,
    preamble: null,
    signer: null,
    extraSigners: [],
    ministryName: null,
    date: null,
    chapters: [],
    commencements: [],
    footnotes: [],
    // Temporary store of state
    current: {
      // In the beinning of each document, sections are paragraphs are put under different chapters.
      // Later, the sections and paragraphs belong under commencements (ikrafttrædelses- og overgangsbestemmelser).
      sectionType: 'chapter'
    }
  };

  // Filter out irrelevant elements
  elements = elements.filter(function(el) { return ! el.attribs.class.match(/bjelke/) && ! el.attribs.class.match(/Indholdsfortegnelse/); } );

  /*
   * ==================================================
   * ================ HELPER FUNCTIONS ================
   * ==================================================
   */
  var _newListItem = function _newListItem(id,no, text) {
    // Push current list item into list of current paragraph's items
    if ( result.current.listItem && result.current.paragraph ) {
      result.current.paragraph.listItems.push( result.current.listItem );

      delete result.current.listItem;
    }

    if ( arguments.length ) {
      result.current.listItem = {
        id: id,
        no: no,
        text: text
      };
    }
  };

  var _newParagraph = function _newParagraph(id, no, text) {
    // First wrap up the current list
    _newListItem();

    // Push current paragraph into list of current section's paragraph
    if ( result.current.paragraph && result.current.section ) {
      result.current.section.paragraphs.push( result.current.paragraph );

      delete result.current.paragraph;
    }

    // Add new current paragraph, if any provided
    if ( arguments.length ) {
      result.current.paragraph = {
        id: id,
        no: no,
        text: text,
        listItems: []
      };
    }
  };

  var _newSection = function _newSection(id, no, text) {
    // First wrap up the current paragraph
    _newParagraph();

    // Push current section (if any) into correct list
    if ( result.current.section ) {
      if ( result.current.sectionType === 'chapter' && result.current.chapter ) {
        result.current.chapter.sections.push( result.current.section );
      } else if ( result.current.sectionType === 'commencement' && result.current.commencement ) {
        result.current.commencement.sections.push( result.current.section );
      } else {
      }

      delete result.current.section;
    }

    // Add new current section, if any provided
    if ( arguments.length ) {
      result.current.section = {
        id: id,
        no: no,
        text: text,
        paragraphs: []
      };
    }
  };

  var _newChapter = function _newChapter(id, no) {
    // First wrap up the current section
    _newSection();

    // Push current chapter onto final list of chapters
    if ( result.current.chapter ) {
      result.chapters.push( result.current.chapter );

      delete result.current.chapter;
    }

    // Add new current chapter, if any provided
    if ( arguments.length ) {
      result.current.chapter = {
        id: id,
        no: no,
        title: null,
        sections: []
      };
    }
  };

  var _newCommencement = function _newCommencement() {
    // First wrap up the current section
    _newSection();

    // If first commencement, switch sectionType to commencement.
    if ( result.current.sectionType === 'chapter' ) {
      _newChapter();
      result.current.sectionType = 'commencement';
    }

    // Push current commencement onto final list
    if ( result.current.commencement ) {
      result.commencements.push( result.current.commencement );

      delete result.current.commencement;
    }

    // Add new current commencement
    result.current.commencement = {
      text: null,
      sections: []
    };
  };

  /*
   * ==================================================
   * =================== MAIN LOOP ====================
   * ==================================================
   */
  elements.forEach(function parseSingleElement(el) {
    // Document title "Titel2"
    if (el.attribs.class.match(/\bTitel2\b/)) {
      result.title = el.children[0].data;
    }

    // Document preamble "Indledning2"
    else if (el.attribs.class.match(/\bIndledning2\b/)) {
      result.preamble = el.children[0].data;
    }

    // New chapter "Kapitel"
    else if (el.attribs.class.match(/\bKapitel\b/) && el.attribs.id) {
      /*
       * Example from document 164746:
       * Note that the id and all three chapter numbers (1) change
       *
       * <p class="Kapitel" id="id74dcab74-f6b1-4417-8ce2-61e75d172b62">
       *   <span id="K1"></span>
       *   <span id="Kap1">Kapitel 1</span>
       * </p>
       */

       var id = el.attribs.id;

       var spanElements = select(el.children, 'span');
       var no = spanElements[0].attribs.id.match(/^K(\d+)$/)[1];

       _newChapter(id, no);
    }

    // After new chapter, comes the chapter title
    else if (el.attribs.class.match(/\bKapitelOverskrift2\b/)) {
      // <p class="KapitelOverskrift2">De almindelige forældelsesfrister</p>

      result.current.chapter.title = el.children[0].data;
    }

    // New section inside current chapter
    else if (el.attribs.class.match(/\bParagraf\b/)) {
      /*
       * <p class="Paragraf" id="id9c6dbd0a-c9fe-458f-a909-65cfa19042d5">
       *    <span id="P5"></span>
       *    <span class="ParagrafNr" id="Par5">§ 4.</span>
       *    Forældelsesfristen er 5 år ved fordringer, som støttes på aftale om udførelse af arbejde som led i et ansættelsesforhold.
       * </p>
       */
      var id = el.attribs.id;
      var spanElements = select(el.children, 'span');
      var no = spanElements[1].children[0].data.match(/^§\s*(.*)\.$/)[1];
      var textElements = el.children.filter(function(el) { return el.type === 'text'; } );

      _newSection(id, no, textElements[2].data.trim());
    }

    // New section inside current commencement (probably)
    else if (el.attribs.class.match(/\bCentreretParagraf\b/)) {
      /*
       * <p class="CentreretParagraf">§ 167</p>
       */
      var textElements = el.children.filter(function(el) { return el.type === 'text'; } );
      var no = textElements[0].data.match(centeredSectionNumberPattern)[1];

      _newSection(null, no, null);
    }

    // New paragraph (Stk) inside current section
    else if (el.attribs.class.match(/\bStk2\b/)) {
      /*
       * Ordinary stk:
       *
       * <p class="Stk2">
       *   <span class="StkNr" id="idf870c1fd-3870-45c1-8ddc-94d47c0d70ca">Stk. 2.</span>
       *   Er der indrømmet skyldneren løbedage eller i øvrigt en frist, inden for hvilken betaling anses for rettidig, regnes forældelsesfristen først fra betalingsfristens udløb.
       * </p>
       *
       */
      var spanElements = select(el.children, 'span');
      var id = spanElements[0].attribs.id;
      var no = spanElements[0].children[0].data.match(/^Stk\.\s*(.*)\.$/)[1];
      var textElements = el.children.filter(function(el) { return el.type === 'text'; } );

      _newParagraph(id, no, textElements[1].data.trim());
    }

    else if (el.attribs.class.match(/\bListe1\b/)) {
      /*
       * <p class="Liste1">
       *   <span class="Liste1Nr" id="id6ddf7d14-fabd-4871-a931-22d90ed81dc6">1)</span>
       *   30 år efter den skadevoldende handlings ophør for fordringer på erstatning eller godtgørelse i anledning af personskade, jf. dog stk. 4, og for fordringer på erstatning for skade forvoldt ved forurening af luft, vand, jord eller undergrund eller ved forstyrrelser ved støj, rystelser el.lign.,
       * </p>
       */
       var spanElements = select(el.children, 'span');
       var id = spanElements[0].attribs.id;
       var no = spanElements[0].children[0].data.match(/^(.+)\)$/)[1];

       var textElements = el.children.filter(function(el) { return el.type === 'text'; } );
       var text = _.join( textElements.map(function(el) { return el.data; }), '' ).trim();

       _newListItem(id, no, text)
    }

    // Separator to next "ikrafttrædelses- og overgangsbestemmelse"
    else if (el.name === 'hr' && el.attribs.class.match(/\bIKraftStreg\b/) ) {
      _newCommencement()
    }

    else if (el.attribs.class.match(/\bIkraftTekst\b/)) {
      /*
       * This <p> comes immediately after a <hr class="IKraftStreg"> (above)
       * Notice casing difference: IKraftStreg, but IkraftTekst (k/K)
       *
       * <p class="IkraftTekst">
       *   Lov nr. 1336 af 19. december 2008 (Konsekvensændringer som følge af lov om inddrivelse af gæld til det offentlige)
       *   <a class="FodnoteHenvisning" name="Henvisning_id037704d5-6e0b-45bb-a1ff-29040078c115" href="#id037704d5-6e0b-45bb-a1ff-29040078c115">1)</a>
       *   indeholder følgende ikrafttrædelses- og overgangsbestemmelse:
       * </p>
       */

       // For now, just join the text elements and don't care about the footnote reference
       var textElements = el.children.filter(function(el) { return el.type === 'text'; } );

       result.current.commencement.text = _.join( textElements.map(function(el) { return el.data; }), '' );
    }

    // Signature part "Givet"
    else if (el.attribs.id && el.attribs.id.match(/\bGivet\b/) ) {
      /*
       * Example from document 164746:
       *
       * <div class="Givet" id="Givet">
       *   <p class="Givet" align="center">Justitsministeriet, den 9. november 2015</p>
       *   <p class="Sign1" align="center">Søren Pind</p>
       *   <p class="Sign2" align="right">/ Mette Johansen</p>
       * </div>
       */
      var classGivet = select(el.children, 'p.Givet');
      var classSign1 = select(el.children, 'p.Sign1');
      var classSign2 = select(el.children, 'p.Sign2');

      if ( classGivet.length !== 1 || classSign1.length !== 1 || classSign2.length !== 1 ) {
        console.error(new Error('Unexpected signature part'));
        console.error(classGivet);
        console.error(classSign1);
        console.error(classSign2);
        return;
      }

      // Parse string like "Sundheds- og Ældreministeriet, den 15. februar 2016" into ministry and date
      var ministryAndDateString = classGivet[0].children[0].data;
      var ministryAndDate = self._parseDocumentMinistryAndDateString(ministryAndDateString);

      // _parseDocumentMinistryAndDateString can return with an Error or an array
      if ( ministryAndDate instanceof Error ) {
        // We can't really break out of the forEach loop easily,
        // so we'll just log to console and continue with next element.
        console.error(ministryAndDate);
        return;
      }

      // Assign ministry name and date
      result.ministryName = ministryAndDate[0];
      result.date = ministryAndDate[1];

      result.signer = classSign1[0].children[0].data;

      // Cut the first two characters "/ ". I have not seen any other variations of this yet.
      result.extraSigners.push( classSign2[0].children[0].data.substr(2) );

    // Footnote
    } else if (el.attribs.class.match(/\bFodnote\b/)) {
      /*
       * <p class="Fodnote">
       *   <a class="FodnoteNr" name="id037704d5-6e0b-45bb-a1ff-29040078c115" href="#Henvisning_id037704d5-6e0b-45bb-a1ff-29040078c115">1)</a>
       *   Lovændringen vedrører § 18, stk. 4, og § 19, stk. 6, 2. pkt.
       * </p>
       */

       // For now, just join the text elements and don't care about the reference
       var textElements = el.children.filter(function(el) { return el.type === 'text'; } );

       var text = _.join( textElements.map(function(el) { return el.data; }), '' );

       result.footnotes.push( text );

    // Otherwise, log an error about this unknown element.
    } else {
      console.error('Unknown element:')
      console.error(el);
    }

  });

  // Clean up
  _newChapter();
  _newCommencement();
  delete result.current;

  done(null, result);
};

/**
 * Retrieves a single document given its ID
 *
 *
 * div.wrapper1 div.wrapper2 div#ctl00_MainContent_Broedtekst1

 * @param {integer} documentId
 * @param {function} done Callback(err, document)
 */
Fetcher.prototype._getDocument = function _getDocument(documentId, done) {
  var self = this;

  this._getDocumentElements(documentId, function(err, elements) {
    if (err) {
      return done(err);
    }

    self._parseDocumentElements(elements, done);
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

/**
 * Retrieves a list of documents of a specific type from a specific ministry
 *
 * @param {integer} ministryId ID as returned from listMinistries
 * @param {integer} documentType Document type (1-6)
 * @param {object} options (Optional) Can contain 'limit' (default 0, all) and 'offset' (default 0)
 * @param {function} done Callback(err, documents)
 */
Fetcher.prototype.listMinistryDocuments = function listMinistryDocuments(ministryId, documentType, options, done) {
  if ( ! done ) {
    done = options;
    options = {};
  }
  this._listMinistryDocuments(ministryId, documentType, options, done);
}

/**
 * Retrieves a single document given its ID
 *
 * @param {integer} documentId
 * @param {function} done Callback(err, document)
 */
Fetcher.prototype.getDocument = function(documentId, done) {
  this._getDocument(documentId, done);
};

module.exports = Fetcher;
