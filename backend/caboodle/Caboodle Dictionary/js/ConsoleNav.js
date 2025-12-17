//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2013-2018
//---------------------------------------------------------------------
// TITLE:   ConsoleNav.js
// PURPOSE: Contains client-side javascript for Console navigation bar
// AUTHOR:  David He
// REVISION HISTORY:
//   dhe  05/2013 271130 - Initial implementation
//   *hf  11/2016 451576 - Never hide the system label
//   *ask 01/2017 405009 - Change updateNavBar function to have groupName selected
//   *yh  01/2017 T23932 - Show Dictionary Editor - DMC/View
//   *yl  04/2017 477312 - Change url in doSearch()
//   *jhe 03/2017 465609 - Set Dict Editor tab text depending on which sub tab is selected
//   *aa  09/2017 474812 - Add support for Hotkeys
//   *sc  09/2017 504888 - Fix pane overlap issue
//   *avm 03/2018 529026 - Remove DMC specific hyperlink for the view editor
//   *zds 10/2018 575698 - Actually fix pane overlap issue
//   *yh  08/2021 810669 - Auto update locale switching spinning icon
//   *crr 09/2022 891677 - Add Tools group
//---------------------------------------------------------------------


define(['Console', 'jquery', 'Utils', 'css!ConsoleNav'], function(Console, $, Utils) {
  /**
   * The console level navigation. The console navigation consists of five 
   * groups, each with a large button and a submenu. Only one group is active 
   * at a given time. Only the active group has a submenu; the other groups 
   * has only a large button. 
   * @constructor
   * @extends Console.UINode
   * @param {Console.App} app - The console instance
   * @param {jQuery} elem - The root element of the navigation
   */
  var Nav = function(app, elem)
  {
    this.app = app;
    Console.UINode.call(this, elem);

    this.initialize();
  };

  Nav.prototype = 
  {
    search: undefined,
    searchUrl: undefined,
    refreshTimer: undefined,

    initialize: function ()
    {
      var self = this;
      var localeSwitchingIcon = this.elem.find('.locale-label-icon-switching:visible');
      if (this.elem.find('.locale-label-icon-switching:visible').length > 0)
      {
        this.refreshTimer = new Console.ServoTimer({
          onTick: function ()
          {
            self.updateSystemLabel();
            if (self.elem.find('.locale-label-icon-switching:visible').length === 0)
            {
              self.refreshTimer.stop();
            }
          }, period: 10.0
        });
        this.refreshTimer.touch();
        this.refreshTimer.start();
      }
      
      var groupsElem = this.elem.children('.console-nav-groups');
      var selectElem = groupsElem.children('.selected');
      this.groupName = selectElem.attr('data-group-name');
      if (this.groupName)
      {
        this.currentGroup = new Nav.Groups[this.groupName](this, selectElem);
      }
      this.resize();

      var $submenuLinks = this.elem.find('.console-nav-groups a');
      $submenuLinks.on('focus.console-nav',
        function ()
        {
          var $link = $(this);
          var $group = $link.closest('.console-nav-groups > li');
          if (!$group.is('.show'))
          {
            $group.addClass('show');
          }
        });
      $submenuLinks.on('blur.console-nav',
        function ()
        {
          var $link = $(this);
          var $group = $link.closest('.console-nav-groups > li');
          if (!$group.find('a:focus').length)
          {
            $group.removeClass('show');
          }
        });

      var $window = $(window);
      $window.on('resize.console-nav',
        function ()
        {
          self.resize();
        });

      var $searchIcon = this.elem.find('.search-icon-link');
      var $closeIcon = this.elem.find('.close-icon-link');
      var $search = this.elem.find('.search-dictionary > div > input[type=text]');
      var $url = this.elem.find('#SearchUrlBase');

      if ($searchIcon.length && $search.length)
      {
        $searchIcon.on('click.console-nav',
          function ()
          {
            if (self.elem.hasClass('show-search'))
            {
              self.doSearch();
            }
            else
            {
              self.elem.addClass('show-search');
              $search.focus();
            }
          });
      }

      if ($closeIcon.length && $search.length)
      {
        $closeIcon.on('click.console-nav',
          function ()
          {
            $search.blur();
            self.elem.removeClass('show-search');
          });
      }

      if ($search.length)
      {
        $search.on('focusout',
          function ()
          {
            self.elem.removeClass('show-search');
          });
      }

      if ($search.length && $url.length)
      {
        this.searchUrl = $url.val();
        this.search = new Console.Placeholder($search, 'Search Dictionary\u2026', true);
        this.search.onEnter = this.doSearch.bind(this);
        $search.on('keydown', function (event) {
            if(event.keyCode === 27)  //Escape
            {
                $search.blur();
                self.elem.removeClass('show-search');
            }
        })
      }

      var $label = this.elem.find('li.system-label > a');
      $label.on('click.console-nav', function () { return false; });

      var accessKeyDomElems = $(this.elem).find('[access-key]');
      for (var i = 0; i < accessKeyDomElems.length; i++) {
        var accessKey = accessKeyDomElems[i].getAttribute('access-key');
        Utils.highlightAccessKey(accessKeyDomElems[i], accessKey);
      }
    },

    resize: function ()
    {
      // Adjust submenu widths
      var $groups = this.elem.find('.activity-group');
      $groups.each(
        function ()
        {
          var $group = $(this);
          var groupWidth = $group.width();
          var $menu = $group.find('.console-nav-submenu');
          var menuWidth = $menu.width();
          var stdWidth = 1.2 * groupWidth;
          if (stdWidth > menuWidth)
          {
            $menu.width(stdWidth);
          }
        });

      // Adjust bar width if it overflows window
      var $document = $(document);
      var $window = $(window);
      var windowWidth = $window.width();

      // Adjust body width to match bar
      var $body = $(document.body);
      if (!$body.children('.console-layers').children('.shade-layer').length)
      {
        var self = this;
        var bodyMarginLeft = parseInt($body.css('margin-left'), 10);
        $body.outerWidth(this.elem.width() - bodyMarginLeft);

        // Set up window scroll handling if necessary
        var $activityNav = $('.activity-nav');
        $document.off('.console-nav');
        if (windowWidth < $activityNav.outerWidth(true) + $body.innerWidth() )
        {
          $document.on('scroll.console-nav',
            function ()
            {
              var scrollLeft = $document.scrollLeft();
              self.elem.css('left', -scrollLeft);
              if ($activityNav.length)
              {
                $activityNav.css('left', -scrollLeft);
              }
            });
        }
        else
        {
          self.elem.css('left', 0);
          if ($activityNav.length)
          {
            $activityNav.css('left', 0);
          }
        }

        // Resize any tables after making body element adjustments
        var $sectionBody = $('section > .body');
        $sectionBody.children('table').each(
          function ()
          {
            var $this = $(this);
            if (!$this.hasClass('table-layout'))
            {
              var $bodyElem = $this.closest('section > .body');
              var bodyWidth = $bodyElem.innerWidth();
              if (bodyWidth)
              {
                $this.outerWidth(bodyWidth);
              }
            }
          });
      }
    },

    doSearch: function ()
    {
      var searchString = this.search.getValue();
      if (searchString)
      {
        var paramString = Utils.formatEncoded.call('#searchString={0}&page=1&resultsPerPage=10&checkboxStatus=111111&disabledPackages=0&Cache', searchString);
        var url = this.searchUrl + paramString;
        window.location = url;
      }
    },

    destroy: function()
    {
      if (this.refreshTimer)
      {
        this.refreshTimer.stop();
      }

      if (this.currentGroup)
      {
        this.currentGroup.destroy();
      }
      this.elem.find('.console-nav-groups a').off('.console-nav');
      this.elem.find('.search-icon-link').off('.console-nav');
      this.elem.find('.close-icon-link').off('.console-nav');
      this.elem.find('li.system-label > a').off('.console-nav');
      if (this.search && this.search.destroy)
      {
        this.search.destroy();
      }
      $(document).off('.console-nav');
      $(window).off('.console-nav');
      Console.UINode.prototype.destroy.call(this);
    }, 
    
    /**
     * Updates the URLs of the main button in each group. 
     */
    update: function ()
    {
      var self = this;
      var groupsElem = this.elem.children('.console-nav-groups');
      groupsElem.children().each(
        function ()
        {
          var $this = $(this);
          var groupName = $this.attr('data-group-name');
          var url = self.app.resolve({ groupName: groupName });
          $this.find('.group-button').attr('href', url);
          if (groupName === 'DictionaryEditor' && url.indexOf('Sources') === -1)
          {
            url = self.app.resolve({ groupName: groupName, pageName: 'Etl' });
            $this.find('li.etl-sub-menu-button a').attr('href', url);
            url = self.app.resolve({ groupName: groupName, pageName: 'ViewEditor' });
          }
        });
      if (self.app.activityName === 'DictionaryEditor' || self.app.activityName === 'Sources')
      {
        var editorType = ''
        if (self.app.activityName === 'Sources')
        {
          editorType = 'Sources';
        }
        else if (self.app.activity.pageName === 'ViewEditor' || self.app.activity.pageName === 'SchemaEditor' || self.app.activity.pageName === 'ViewQuery')
        {
          editorType = 'Views'
        }
        else
        {
          editorType = 'DMCs'
        }
        var $dictionaryEditorType = self.elem.find('#dictionary-editor-group');
        if (editorType)
        {
          $dictionaryEditorType.text('Dictionary Editor - ' + editorType);
          var accessKeyParentElements = $dictionaryEditorType.closest("[access-key]");
          if(accessKeyParentElements && accessKeyParentElements.length==1)
          {
            var accessKey = accessKeyParentElements[0].getAttribute('access-key');
            accessKeyParentElements[0].accessKeyHighlighted = false;
            Utils.highlightAccessKey(accessKeyParentElements[0], accessKey);
          }
        }
      }
      
      var $linksToResolve = this.elem.find('li.resolve-link[data-activity-name][data-page-name]');
      $linksToResolve.each(
        function ()
        {
          var $this = $(this);
          var activityName = $this.attr('data-activity-name');
          var pageName = $this.attr('data-page-name');
          var url = self.app.resolve({ activityName: activityName, pageName: pageName });
          $this.find('a').attr('href', url);
        });
    },

    updateSystemLabel: function ()
    {
      var $cssLink = $('link#DynamicStyle');
      var urlEnding = '?reload=' + new Date().getTime();
      $cssLink.each(
        function ()
        {
          this.href = this.href + urlEnding;
        });

      var self = this;
      var app = Console.instance;
      return self.request({
        url: app.baseUrl + 'config/SystemLabelSettings',
        type: 'GET',
        name: 'system-label',
        requestCollision: 'suppress'
      })
      .done(function (response)
      {
        var text = response.text;
        var isSwitching = response.isSwitching;
        var localeId = response.localeId;
        var locale = response.locale;

        var $localeFlag = self.elem.find('img.locale-flag');
        if ($localeFlag.length)
        {
          $localeFlag.attr('src', app.baseUrl + 'img/locales/locale' + localeId + '-navbar.png');
          $localeFlag.attr('title', locale);
        }

        if (isSwitching === false)
        {
          self.elem.find('.locale-label-icon-switching').hide();
        }

        var $label = self.elem.find('li.system-label');
        var $textBox = $label.find('a > div > span');
        if (!$textBox.length)
        {
            $textBox = $label.find('div.system-label-locale-label');
        }
        if ($label.length && $textBox.length)
        {
          $textBox.text(text);
          if (text)
          {
            $textBox.attr('title', text);
          }
          else
          {
            $textBox.removeAttr('title');
          }
          self.resize();
        }
      });
    },

    updateIssueCount: function ()
    {
      var self = this;
      var app = Console.instance;
      return self.request({
        url: app.baseUrl + 'issues/Count',
        type: 'GET',
        name: 'issue-count',
        requestCollision: 'suppress'
      })
      .done(function (response)
      {
        var count = response.count;
        self.elem.find('li.activity-group .group-name > .issue-count').text(count);
      });
    },

    updateNavBar: function (selectOldGroupName)
    {
      var self = this;
      var app = Console.instance;
      var selectGroupParameters = "";
      if (selectOldGroupName)
      {
          selectGroupParameters = "?groupName=" + app.groupName + "&activityName=" + app.activityName;
      }
      return self.requestHtml(
        {
          url: app.baseUrl + 'config/ConsoleNav' + selectGroupParameters,
          type: 'GET',
          name: 'nav-bar',
          requestCollision: 'suppress'
        })
      .done(
        function (response)
        {
          self.destroy();
          var $barNew = $(response);
          $barNew.insertAfter(self.elem);
          self.elem.remove();
          self.elem = $barNew;
          self.initialize();
        });
    }
  
};
  Utils.inherit(Nav, Console.UINode);

  
  
  /**
   * Base, abstract class for a group. 
   * @constructor
   * @extends Console.UINode
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  var BaseGroup = Nav.BaseGroup = function(nav, elem)
  {
    Console.UINode.call(this, elem);
    this.nav = nav;
    this.submenu = this.elem.find('.console-nav-submenu');
  };
  
  BaseGroup.prototype = 
  {
      /**
       * Sets the currently selected activity. 
       * @param {string} activityName
       */
      setActivityName: function(activityName)
      {
          this.submenu.children('.selected').removeClass('selected');
          this.submenu.children('[data-activity-name="' + activityName + '"]').addClass('selected');
      }
  };
  Utils.inherit(BaseGroup, Console.UINode);

  Nav.Groups = {};
  
  /**
   * The Dictionary navigation group in the Console navigation. The submenu 
   * consists of the table categories for filtering the activity level tables 
   * list. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Nav.Groups.Dictionary = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };

  Nav.Groups.Dictionary.prototype =
  {
    destroy: function()
    {
      this.submenu.off('click');
      BaseGroup.prototype.destroy.call(this);
    }, 
    
    /**
     * Sets the currently selected category. 
     * @param {string} category
     */
    setCategory: function(category)
    {
      this.submenu.children('.selected').removeClass('selected');
      this.submenu.children('[data-category="' + category + '"]').addClass('selected');
    },
    
    // The dictionary navigation group doesn't have activities. 
    setActivity: function (activityName) { }
  };
  Utils.inherit(Nav.Groups.Dictionary, BaseGroup);

  Nav.Groups.ClarityTablesByApp = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };
  Utils.inherit(Nav.Groups.ClarityTablesByApp, BaseGroup);
  
  /**
   * The Dictionary Editor navigation group in the Console navigation. The 
   * submenu consists of the table categories for filtering the activity level 
   * table ETLs list. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Nav.Groups.DictionaryEditor = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };

  Nav.Groups.DictionaryEditor.prototype =
  {
    destroy: function()
    {
      this.submenu.children().off('click');
      BaseGroup.prototype.destroy.call(this);
    }, 

    /**
     * Sets the currently selected category. 
     * @param {string} category
     */
    setCategory: function(category)
    {
      this.submenu.children('.selected').removeClass('selected');
      this.submenu.children('[data-category="' + category + '"]').addClass('selected');
    }, 
    
    // The dictionary editor navigation group doesn't have activities. 
    setActivity: function(activityName) {}
  };
  Utils.inherit(Nav.Groups.DictionaryEditor, BaseGroup);
  
  /**
   * The Executions navigation group in the Console navigation. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Nav.Groups.Executions = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };
  Utils.inherit(Nav.Groups.Executions, BaseGroup);

  
  /**
   * The WorkQueue navigation group in the Console navigation. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Nav.Groups.WorkQueue = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };
  Utils.inherit(Nav.Groups.WorkQueue, BaseGroup);

  
  /**
   * The Configuration navigation group in the Console navigation. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Nav.Groups.Configuration = function(nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };
  Utils.inherit(Nav.Groups.Configuration, BaseGroup);

  /**
   * The Tools navigation group in the Console navigation.
   * @param {any} nav
   * @param {any} elem
   */
  Nav.Groups.Tools = function (nav, elem)
  {
    BaseGroup.call(this, nav, elem);
  };
  Utils.inherit(Nav.Groups.Tools, BaseGroup);

  /**
   * The Configuration navigation group in the Console navigation. 
   * @constructor
   * @extends Nav.BaseGroup
   * @param nav {Nav} The console level navigation
   * @param elem {!jQuery} The root element
   */
  Console.SwitchLocale = function (elem, context)
  {
    var PrevSkipRecreateViews = localStorage.getItem('PrevSkipRecreateViews');
    var PrevSkipDurationDimTranslation = localStorage.getItem('PrevSkipDurationDimTranslation');
    Console.FormDialog.call(this, elem);
    document.getElementById('SkipRecreateViews').checked = PrevSkipRecreateViews !== "false";
    document.getElementById('SkipDurationDimTranslation').checked = PrevSkipDurationDimTranslation !== "false";
  };
  Utils.inherit(Console.SwitchLocale, Console.FormDialog);

  Console.SwitchLocale.Loader = function (context)
  {
    var app = Console.instance;
    var url = app.baseUrl + 'config/SwitchLocale'
    Console.RemoteDialogLoader.call(this, url, context);
  };

  Console.SwitchLocale.Loader.prototype =
  {
    createDialog: function (elem)
    {
      return new Console.SwitchLocale(elem, this.context);
    },
 
    postCloseActions: function (dialog, closeReason, response)
    {
      var PrevSkipRecreateViews = document.getElementById('SkipRecreateViews').checked;
      var PrevSkipDurationDimTranslation = document.getElementById('SkipDurationDimTranslation').checked;
      localStorage.setItem('PrevSkipRecreateViews', PrevSkipRecreateViews);
      localStorage.setItem('PrevSkipDurationDimTranslation', PrevSkipDurationDimTranslation);

      if (closeReason === 'submit')
      {
        location.reload();
        Nav.initialize();
      }

      return this.refresh();
    }
  };
  Utils.inherit(Console.SwitchLocale.Loader, Console.RemoteDialogLoader);

  return Nav;
});

