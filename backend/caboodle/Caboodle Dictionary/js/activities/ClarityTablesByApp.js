//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2015-2015 
//---------------------------------------------------------------------
// TITLE:   ClarityTablesByApp.js
// PURPOSE: Contains client-side javascript for ClarityTablesByApp activity
// AUTHOR:  Nick Etzel
// REVISION HISTORY:
//   *ne  06/2015 T8226  - Initial implementation
//---------------------------------------------------------------------

define(
  ['jquery', 'Console', 'app', 'Utils', 
    'css!activities/ClarityTablesByApp'], 
  function($, Console, app, Utils)
  {
    var global = this;
    var ClarityTablesByApp = {};

    ClarityTablesByApp.Activity = function()
    {
      Console.Activity.call(this);
      var pageElem = this.elem.find('.page');
      this.page = new ClarityTablesByApp.Page(pageElem);
    };
    Utils.inherit(ClarityTablesByApp.Activity, Console.Activity);

    ClarityTablesByApp.Page = function (elem)
    {
      Console.Page.call(this, elem);
      this.sections.push(
        new ClarityTablesByApp.MainSection(this.elem.find('.main-section'))
      );
    };
    Utils.inherit(ClarityTablesByApp.Page, Console.Page);

    /**
     * Main section in the Clarity Table By Application page
     * @constructor
     * @extends Console.PageSection
     * @param {!jQuery} elem - The root element of the section
     */
    ClarityTablesByApp.MainSection = function (elem)
    {
      Console.PageSection.call(this, elem);

      this.packages = global.resources.getClarityTablesByAppAndVersion();

      this.elem.on('change', this.filterTablesList.bind(this));

      this.versions = this.elem.find('#EpicVersion');
      this.versions[0].selectedIndex = this.versions[0].length - 1;

      this.filterTablesList();
    };
    ClarityTablesByApp.MainSection.prototype =
    {
      packages: undefined,

      destroy: function ()
      {
        this.elem.off('change');
        Console.Page.prototype.destroy.call(this);
      },

      /*  
       * Filter list of clarity tables based on installed application
       * and Version selected.
      */
      filterTablesList: function ()
      {
        var appIds = [];

        this.elem.find('input[type=checkbox]:checked').each(function ()
        {
          var selApp = $(this).closest('li').attr('data-application-id');
          appIds.push(parseInt(selApp, 10));
        });

        var version = this.elem.find('#EpicVersion').val();

        this.update(appIds, version);
      },

      /*  
       * Show or Hide the tables based on version and installed 
       * application filters selected
       */
      update: function (appIds, version)
      {
        var tables = {};
        
        for (var pkgname in this.packages)
        {
          var pkg = this.packages[pkgname];

          // If package should be shown for selected version
          if ((pkg.FirstEpicVersionId <= version) && (version <= pkg.LastEpicVersionId))
          {
            // If package should be shown for selected applications
            var found = false;
            for (var i = 0; (i < appIds.length) && (!found) ; i++)
            {
              found = (pkg.ApplicationIds.indexOf(appIds[i]) > -1);
            }

            // Add list of clarity tables in tables if package should be shown
            if (found)
            {
              for (var i = 0; i < pkg.TableNames.length; i++)
              {
                tables[pkg.TableNames[i]] = 1;        
              }
            }
          }
        }

        var empty = true;
        this.elem.find(".clarity-tables li").each(function ()
        {
          var tableName = $(this).attr('id');
          var display = tables[tableName] === 1;
          empty = empty && !display;
          $(this).toggle(display);
        });
        this.elem.find('.empty-list').toggle(empty);
      }
    };
    Utils.inherit(ClarityTablesByApp.MainSection, Console.PageSection);

    return ClarityTablesByApp;
  })