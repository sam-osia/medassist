//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2013-2018
//---------------------------------------------------------------------
// TITLE:   css.js
// PURPOSE: A module loader plugin for loading Cascading Style Sheets. 
// AUTHOR:  David He
// REVISION HISTORY:
//   *dh  04/2013 256037 - Initial Implementation
//   *avm 04/2018 541081 - Load minified css
//---------------------------------------------------------------------

define(['Utils', 'loader'], function(Utils, loader) {
  var Deferred = Utils.Deferred;
  var global = this;
  
  /**
   * @param {Core} The loader core. Options for this plugin are copied from the 
   *   core. 
   */
  var CssLoader = function(core)
  {
    this.core = core;
    this.urls = {};
  }; 

  CssLoader.prototype = 
  {
    constructor: CssLoader, 
    
    /**
     * Resolves the URL of the specified CSS module. 
     * @param {string} id - The resource ID of the module
     * @returns {string} an absolute URL
     */
    resolveUrl: function(id)
    {
      id = this.core.constructor.normalize(id);
      var url = this.core.cssBase 
        + (this.core.alias[id] || id) + '.min.css' 
        + this.core.urlArgs;
      
      // Convert relative URL to absolute URL if not a local file
      if (global.location.protocol != 'file:')
      {
        url = Utils.toAbsoluteUrl(url);
      }
      
      return url;
    }, 

    /**
     * Loads the specified CSS module. 
     * @param {string} id - The resource ID of the module to load. 
     * @returns {!Promise} A promise that is resolved when the module is loaded. 
     */
    load: function(id)
    {
      // memoize
      var url = this.resolveUrl(id);
      if (!(url in this.urls))
      {
        this.urls[url] = null;
        CssLoader.retrieveStyleSheet(url);
      }
      return Deferred.unit();
    }
  };
  
  /**
   * Retrieves a CSS file by inserting a <link> element whose href attribute 
   * points to the specified URL. 
   * @param {url} The url
   */
  CssLoader.retrieveStyleSheet = function(url)
  {
    // Don't continue if the stylesheet is already loading or loaded
    var links = document.getElementsByTagName('link');
    for (var i = 0; i < links.length; i++)
    {
      var link = links[i];
      if (link.href == url)
      {
        return;
      }
    }
    
    var elem = document.createElement('link');
    elem.setAttribute('rel', 'stylesheet');
    elem.href = url;
    elem.type = 'text/css';

    var head = document.getElementsByTagName('head')[0];
    head.appendChild(elem);
  };

  return new CssLoader(loader);
});