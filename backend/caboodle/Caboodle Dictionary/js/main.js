/*! Copyright (c) Epic Systems Corporation 2013 */

(function() {
  var baseUrl = document.getElementsByName('base-url')[0].getAttribute('content');
  var resourceLastWrite = document.getElementsByName('resource-last-write')[0].getAttribute('content');
  var isStatic = /static/.test(document.getElementsByTagName('html')[0].className);
  this.useNewFramework = true;

  loader.setup({
    jsBase: baseUrl + 'js/', 
    cssBase: baseUrl + 'css/', 
    urlArgs: isStatic ? '' : '?v=' + resourceLastWrite, 
    
    alias: 
    {
      jquery: 'vendor/jquery-1.10.2', 
      app: 'Console'
    },
    
    shim:
    {
      'vendor/jquery.validate': 
      {
        deps: ['jquery']
      }, 
      
      'vendor/jquery.mousewheel': 
      {
        deps: ['jquery']
      }
    }, 
    
    defineMode: 'lazy'
  });
  
  define('modernizr', [/* 'vendor/modernizr-2.6.2' */], function() { return Modernizr; });
  define('json2', ['vendor/json2'], function() { return JSON; });
  define('jquery.validate', ['vendor/jquery.validate'], undefined);
  define('jquery.mousewheel', ['vendor/jquery.mousewheel'], undefined);
  
  
  require(['Console', 'app', 'jquery'], function(Console, app, $) {
    var document = this.document;
    $(document).ready(function() {
      Console.App.call(app, baseUrl);
    
      $(window).on('beforeunload', app.destroy.bind(app));
    });
  });
})();
