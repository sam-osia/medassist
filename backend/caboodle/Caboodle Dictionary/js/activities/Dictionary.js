//----------------------------------------------------
// Copyright 2020 Epic Systems Corporation
//----------------------------------------------------
// TITLE:   Dictionary.js
// PURPOSE: Java script for Dictionary activity
// AUTHOR:  David He
// REVISION HISTORY:
//   dhe  05/2013 271130 - Initial implementation
//   *zds 12/2020 657733 - Remove very inefficient dead code
//   *avm 01/2021 753616 - Remove notes
//----------------------------------------------------


define(
['jquery', 'Console', 'app', 'Utils', 'Sortable', 'activities/DictionaryTs'], 
  function($, Console, app, Utils, Sortable)
{
  var global = this;

  var TsDictionary = new DictionaryTs();
  var Dictionary = {};
  var Table = Dictionary.Table = {};
  var ErDiagrams = Dictionary.ErDiagrams = {};

  /** 
   * The dictionary activity. 
   * @constructor
   * @extends Console.Activity
   */
  Dictionary.Activity = function()
  {
    Console.Activity.call(this);
    this.nav = new Dictionary.Nav($('.activity-nav'));
    this.initPage();
  };
  
  Dictionary.Activity.prototype = 
  {
    pageName: undefined,
    tableName: undefined,
    etlName: undefined,

    initPage: function()
    {
      var pageElem = $('.page');
      this.pageName = pageElem.attr('data-page-name');
      var Page = Dictionary[this.pageName].Page;
      this.page = Object.create(Page.prototype);
      Page.call(this.page, pageElem);

      this.tableName = this.page.elem.attr('data-table-name');
      this.etlName = this.page.elem.attr('data-etl-name');
      
      this.nav.select(this.tableName);
      this.nav.needNormalize = true;
      this.nav.updateList();
    }, 
    
    loadPageHelper: function(pageDesc)
    {
      var self = this;
      var app = Console.instance;
      
      // Load other dictionary entries asynchronously on browsers 
      // which support it. 
      if (app.useHistory
        && pageDesc.activityName === app.activityName)
      {
        this.dialogs.forEach(function(dialog) {
          if (dialog.isOpen()) { dialog.close(); }
        });

        return this.page.requestPage(pageDesc)
          .done(function(page, props) {
            self.page.destroy();
            self.page.elem.replaceWith(page);
            self.initPage();
            
            $(window).scrollTop(0);
            if (app && app.nav && app.nav.resize)
            {
              app.nav.resize();
            }
          });
      }
      else
      {
        return Console.Activity.prototype.loadPageHelper.call(this, pageDesc)
          .done(
            function ()
            {
              if (app && app.nav && app.nav.resize)
              {
                app.nav.resize();
              }
            });
      }
    }
  };
  Utils.inherit(Dictionary.Activity, Console.Activity);
  
  
  /** 
   * The dictionary activity navigation bar. 
   * @constructor
   * @extends Console.ActivityNav
   */
  Dictionary.Nav = function(elem)
  {
    Console.ActivityNav.call(this, elem);
    this.list = new Console.List(
      this.elem.find('.main-list'), 
      {
        idAttrName: 'data-table-name'
      });

    var ie9Compat = $(document).children('html.lt-ie10').length > 0;
    if (ie9Compat)
    {
      this.searchPlaceholder = new Console.Placeholder(this.searchElem, 'Filter components\u2026');
      this.updateList();
    }
  };
  
  Dictionary.Nav.prototype = 
  {
    /**
     * Updates table list, showing tables filtered on the selected category and 
     * the search string. 
     */
    updateList: function()
    {
      var self = this;
      var valBase = this.searchElem.val();
      var searchVal = $.trim(valBase.toLowerCase());
      if (this.searchPlaceholder && valBase.indexOf(this.searchPlaceholder.escapeChar) === 0)
      {
        searchVal = '';
      }
    
      var count = 0;
      var visibleTables = {};
      this.list.findAll().each(function() {
        var $this = $(this);
        var tableName = $this.attr('data-table-name');
        var visible = tableName.toLowerCase().indexOf(searchVal) !== -1;

        $this.toggle(visible);
        if (visible)
        {
          visibleTables[tableName] = true;
        }
        count += visible;
      });

      this.list.findAll().find('[data-table-name][data-parent-name]').each(
        function ()
        {
          var $this = $(this);
          var parentName = $this.attr('data-parent-name');
          $this.toggleClass('attr-value', visibleTables[parentName] === true);
        });

      this.elem.find('.empty-list').toggle(count === 0);
      this.updateLayout();
    },

    refresh: function () {
      var self = this;
      return this.requestHtml({
        url: app.baseUrl + 'tables/none',
        name: 'refresh'
      })
        .done(function (elem) {
          self.list.refreshWith(elem.find('.main-list'));
          self.updateLayout();
      });
    },

    loadInvalidateLicenseCache: function (event) {
      var self = this;
      var onError = function (response, errorType, jqxhr) {
        $.when(
            this.refresh(),
            app.activity.page.refresh()
          )
      };

      var onSuccess = function (response, errorType, jqxhr) {
        $.when(
            self.refresh(),
            app.activity.page.refresh()
          )
      };

      $.when(this.postInvalidateLicenseCache().fail(onError)).done(onSuccess);
    },

    postInvalidateLicenseCache: function () {
      return this.request({
        url: app.baseUrl + 'etls/InvalidateLicenseCache',
        type: 'POST',
        requestCollision: 'suppress'
      });
    }
  };
  Utils.inherit(Dictionary.Nav, Console.ActivityNav);
  
 /**
  * ER diagrams page in the dictionary activity
  * @constructor
  * @extends Console.Page
  * @param {jQuery} elem - The root element of the page
  */
  ErDiagrams.Page = function (elem)
  {
    this.elem = elem;
    var self = this;

    //instantate ErDiagrams object from Typescrpt
    this.erDiagrams = new TsDictionary.ErDiagrams(elem);

    //instantiate sortable objects here, since we can't do that in the Typescript file
    this.sortable = new ErDiagrams.Page.Sortable(this.erDiagrams);
    Console.Page.call(this, elem);
  };

  ErDiagrams.Page.prototype =
  {
    elem: undefined,
    erDiagrams: undefined,

    /**
     * @description Destroys objects and events created by the er diagrams page 
     */
    destroy: function ()
    {
      this.erDiagrams.destroy();
      this.sortable.destroy();
      Console.Page.prototype.destroy.call(this);
    }
  };
  Utils.inherit(ErDiagrams.Page, Console.Page);

  /**
   * @description Sortable behavior for Er Diagrams
   * @param  {jQuery} elem - sortable targets. All first children of these targets will be sortable
   * @param  {jQuery} erDiagram - er diagram root page element
   * @extends Sortable
   */
  ErDiagrams.Page.Sortable = function (erDiagram)
  {
    this.erDiagram = erDiagram;
    var elem = $('#left-card-container');
    var args =
    {
      sortableItems: '.sortable-item',
      connectWith: '#right-card-container',
      sortHandle: '.move-icon',
      scrollWindow: true
    };
    Sortable.call(this, elem, args);
  };

  ErDiagrams.Page.Sortable.prototype =
  {
    erDiagram: undefined,
    /**
     * @description a set of tasks unique to the er diagrams page that should happen when the drag event is initiated
     */
    onMouseDown: function (event, sortable)
    {
      var success = Sortable.prototype.onMouseDown.call(this, event, sortable);
      if (success)
      {
        this.erDiagram.clearCanvas();
      }
    },
     /**
     * @description a set of tasks unique to the er diagrams page that should happen when the drop event is completed
     */
    onMouseUp: function (event)
    {
      Sortable.prototype.onMouseUp.call(this, event);
      this.erDiagram.connect();
    }
  };
  Utils.inherit(ErDiagrams.Page.Sortable, Sortable);
  /**
   * Page in the dictionary activity
   * @constructor
   * @extends Console.Page
   * @param {jQuery} elem - The root element of the page
   */
  Table.Page = function(elem)
  {
    Console.Page.call(this, elem);
    
    var propertiesElem = this.elem.children('.properties');
    if (propertiesElem.length)
    {
      this.properties = new Table.Properties(propertiesElem);
      this.sections.push(this.properties);
    }
    
    var columnsElem = this.elem.children('.columns');
    if (columnsElem.length)
    {
      this.columns = new Table.Columns(columnsElem);
      this.sections.push(this.columns);
    }
    
    var sourcesElem = this.elem.children('.sources');
    if (sourcesElem.length)
    {
      this.sources = new Table.Sources(sourcesElem);
      this.sections.push(this.sources);
    }
  };
  
  Table.Page.prototype = 
  {
    destroy: function()
    {
      Console.Page.prototype.destroy.call(this);
    },

    /**
      * Loads a dialog to display the package query
      */
    loadViewPackageQueryDialog: function (event, target)
    {
        var packageName = target.closest('[data-package-name]').attr('data-package-name');
        Table.ViewPackageQuery.load(this, [app.activity.tableName, packageName]);
    },
  };
  Utils.inherit(Table.Page, Console.Page);
 
  
  /**
   * Properties section in the dictionary page
   * @constructor
   * @extends Console.PageSection
   * @param {!jQuery} elem - The root element of the section
   */
  Table.Properties = function(elem)
  {
    Console.PageSection.call(this, elem);
  };
  Utils.inherit(Table.Properties, Console.PageSection);

  /*
   * Sources section in the dictionary page
   * @constructor
   * @extends Console.PageSection
   * @param {!jQuery} elem - The root element of the section
   */
  Table.Sources = function(elem)
  {
    Console.PageSection.call(this, elem);

    // Add source object to each source
    var sourceElems = this.body.children('.source');
    for (var i = 0; i < sourceElems.length; i++)
    {
      var source = new Table.Source($(sourceElems[i]));
      this.sections.push(source);
    }
  };
  Utils.inherit(Table.Sources, Console.PageSection);

  /*
   * Source section within sources section
   * @constructor
   * @extends Console.PageSection
   * @param {!jQuery} elem - The root element of the section
   */
  Table.Source = function (elem)
  {
    Console.Section.call(this, elem);
  };

  /*
   * Members and functions definition for source
   */
  Table.Source.prototype =
  {
    /*
     * Toggle the source
     */
    toggle: function (open)
    {
      Console.Section.prototype.toggle.call(this, open);
    }
  };
  Utils.inherit(Table.Source, Console.PageSection);

  /**
    * Form dialog for displaying a package query
    * @constructor
    * @extends Console.FormDialog
    * @mixes Console.redirectRevision
    * @param {!jQuery} elem - The root element of the dialog
    * @param {!Console.UINode} context - The context from which this dialog was opened
    */
  Table.ViewPackageQuery = function (elem)
  {
      Console.FormDialog.call(this, elem);
  };
  Utils.inherit(Table.ViewPackageQuery, Console.FormDialog);

  /**
    * Loads a dialog to display a package query 
    * @param {!Console.UINode} context - The context from which to load the dialog. 
    */
  Table.ViewPackageQuery.load = Console.buildRemoteDialogLoadMethod('tables/{0}/packages/{1}/ViewPackageQuery');

  /**
   * Columns section in the dictionary page
   * @constructor
   * @extends Console.PageSection
   * @param {!jQuery} elem - The root element of the section
   */
  Table.Columns = function(elem)
  {
    Console.PageSection.call(this, elem);
    
    var columnElems = this.body.children('.column');
    this.focusColumn = location.hash.substring(1) || '';
    var button = this.getHeader().find('button');
    button.css('z-index', columnElems.length + 1);
    for (var i = 0; i < columnElems.length; i++)
    {
      var column = new Table.Column($(columnElems[i]), this);
      column.elem.css('z-index', columnElems.length - i);
      this.sections.push(column);
    }
    
    this.openCount = 0;
    this.updateToggle();
  };
  
  Table.Columns.prototype = 
  {
    expandAll: function(event, target)
    {
      var isExpand = target.hasClass('expand');
      for (var i = 0; i < this.sections.length; i += 1)
      {
        this.sections[i].toggle(isExpand);
      }
    }, 
    
    // Updates the expand/collapse all button
    updateToggle: function()
    {
      var isExpand = this.openCount !== this.sections.length;
      var button = this.getHeader().find('button');
      var textNode = button[0].firstChild;
      textNode.nodeValue = isExpand ? 'Expand All' : 'Collapse All';
      button.toggleClass('expand', isExpand);
      button.attr('title', isExpand
        ? 'Show details of all columns'
        : 'Hide details of all columns');
    }
  };
  Utils.inherit(Table.Columns, Console.PageSection);
  
  /**
   * Column inner section in the columns section
   * @constructor
   * @extends Console.Section
   * @param {!jQuery} elem - The root element of the section
   */
  Table.Column = function(elem, parent)
  {
    Console.Section.call(this, elem);
    this.parent = parent;
    this.columnName = this.elem.attr('data-column-name');
    this.elem.find('details').details();
    this.elem.change(this.updateToggle.bind(this));
    if (this.parent.focusColumn === this.columnName)
    {
      this.toggle(true);
      this.elem.find('details').each(function ()
      {
        $(this).find('summary').click();
      });
    }
    
    
    this.updateChop();
  };

  Table.Column.prototype = 
  {
    destroy: function()
    {
      this.elem.find('details').details('destroy');
      Console.Section.prototype.destroy.call(this);
    }, 
    
    toggle: function(open)
    {
      if (this.isOpen())
      {
        this.parent.openCount -= 1;
      }
      
      Console.Section.prototype.toggle.call(this, open);
      
      if (this.isOpen())
      {
        this.parent.openCount += 1;
      }
      
      this.parent.updateToggle();
      this.updateChop();
    }, 
    
    expandAll: function(event, target)
    {
      var isExpand = target.hasClass('expand');
      this.elem.find('details').details('toggle', isExpand);
      this.updateToggle();
    }, 
    
    
    updateChop: function()
    {
      var self = this;
      var isOpen = this.isOpen();
      
      this.elem.find('.column-description')
        .each(function() {
          $(this).children('p:first')
            .toggleClass('remain', isOpen)
            .toggleClass('overflow-ellipsis nowrap no-tooltip', !isOpen);
        })
        .each(function() {
          var ps = $(this).children('p');
          if (ps.length)
          {
            var visible = ps.length > 1 
              && !self.isOpen()
              && !(ps[0].offsetWidth < ps[0].scrollWidth);            
            ps.first().toggleClass('ellipsis', visible);
          }
        });
    }, 
    
    // Updates the expand/collapse all button in data lineage
    updateToggle: function()
    {
      var isExpand = this.elem.find('details:not([open])').length !== 0;
      var button = this.elem.find('button.expand-all');
      var textNode = button[0].firstChild;
      textNode.nodeValue = isExpand ? 'Expand All' : 'Collapse All';
      button.toggleClass('expand', isExpand);
      button.attr('title', isExpand
        ? 'Show data lineage of all extraction packages'
        : 'Hide data lineage of all extraction packages');
    }
  };
  Utils.inherit(Table.Column, Console.Section);

  return Dictionary;
});
