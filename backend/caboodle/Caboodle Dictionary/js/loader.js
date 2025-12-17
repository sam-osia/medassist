/*! Copyright (c) Epic Systems Corporation 2013 */

(function() {
  
  /* Polyfills for Object and Array.prototype */
  (function() {
    /* 
     * Polyfill for Object.create . 
     */
    if (!Object.create)
    {
      /*
       * An abridged version of ECMAScript 5's Object.create [0] which supports only
       * the first parameter. 
       *
       * [0] ECMA-262 5th edition §15.2.3.5
       */
      Object.create = function(obj) 
      {
        var ctor = function() {};
        ctor.prototype = obj;
        return new ctor();
      };
    }
    
    
    /* 
     * Polyfill for Array.prototype.map .
     */
    if (!Array.prototype.map)
    {
      Array.prototype.map = function(f, context)
      {
        var ys = [];
        var length = this.length;
        for (var i = 0; i < length; i++)
        {
          ys[i] = f.call(context, this[i]);
        }
        return ys;
      };      
    }
    
    
    /* 
     * Polyfill for Array.prototype.forEach .
     */
    if (!Array.prototype.forEach)
    {
      Array.prototype.forEach = function(f, context)
      {
        var length = this.length;
        for (var i = 0; i < length; i++)
        {
          f.call(context, this[i]);
        }
      };      
    }
  })();


  /* 
   * An implementation of the promise design pattern. 
   * 
   * The promise design pattern is widely used, so we do not document it here. 
   * Please refer to a third party implementation for details about usage. 
   */
  var Deferred = (function() {
    var Deferred = function()
    {
      this.dones = [];
      this.fails = [];
      this.state = 'pending';
      this._promise = new Deferred.Promise(this);
    };

    Deferred.prototype = 
    {
      constructor: Deferred, 

      resolve: function()
      {
        if (this.state != 'pending')
        {
          return this;
        }

        this.result = arguments;
        this.state = 'resolved';
        for (var i = 0; i < this.dones.length; i++)
        {
          this.dones[i].apply(this.promise(), this.result);
        }
        delete this.dones;
        delete this.fails;
        return this;
      }, 

      reject: function()
      {
        if (this.state != 'pending')
        {
          return this;
        }

        this.result = arguments;
        this.state = 'rejected';
        for (var i = 0; i < this.fails.length; i++)
        {
          this.fails[i].apply(this.promise(), this.result);
        }
        delete this.dones;
        delete this.fails;
        return this;
      }, 

      promise: function()
      {
        return this._promise;
      }
    };

    Deferred.Promise = function(dfd)
    {
      this.dfd = dfd;
    };

    Deferred.Promise.prototype =
    {
      constructor: Deferred.Promise, 

      done: function(cb)
      {
        switch (this.dfd.state)
        {
          case 'pending':
            this.dfd.dones.push(cb);
            break;

          case 'resolved':
            cb.apply(this, this.dfd.result);
            break;
        }
        return this;
      }, 

      fail: function(cb)
      {
        switch (this.dfd.state)
        {
          case 'pending':
            this.dfd.fails.push(cb);
            break;

          case 'rejected':
            cb.apply(this, this.dfd.result);
            break;
        }
        return this;
      }, 
    
      always: function()
      {
        return this
          .done.apply(this, arguments)
          .fail.apply(this, arguments)
          ;
      }, 

      then: function(doneCb, failCb)
      {
        doneCb = doneCb || function() { return Deferred.unit.apply(this, arguments); };
        failCb = failCb || function() { return Deferred.failUnit.apply(this, arguments); };
        
        var dfd = new Deferred();
      
        this.always(function() {
          (this.state() == 'resolved' ? doneCb : failCb)
            .apply(dfd, arguments)
            .done(dfd.resolve.bind(dfd))
            .fail(dfd.reject.bind(dfd));
        });

        return dfd.promise();
      }, 

      state: function()
      {
        return this.dfd.state;
      }
    };

    Deferred.unit = function()
    {
      var dfd = new Deferred();
      dfd.resolve.apply(dfd, arguments);
      return dfd.promise();
    };

    Deferred.failUnit = function()
    {
      var dfd = new Deferred();
      dfd.reject.apply(dfd, arguments);
      return dfd.promise();
    };

    Deferred.when = function()
    {
      var dfds = arguments;
      var dfd = new Deferred();
      var doneCount = 0;
      var results = [];

      var checkDone = function()
      {
        if (doneCount == dfds.length)
        {
          dfd.resolve.apply(dfd, results);
        }
      };

      for (var i = 0; i < dfds.length; i++)
      {
        (function(i) {
          dfds[i].done(function(result) {
            results[i] = result;
            doneCount += 1;
            checkDone();
          })
          .fail(function() {
            dfd.reject.apply(dfd, results);
          });
        })(i);
      }

      if (dfds.length == 0)
      {
        checkDone();
      }

      return dfd.promise();
    };

    return Deferred;
  })();


  var global = this, 
    document = this.document, 
    context = undefined, 
    loader;
  
  
  /**
   * @classdesc
   * An module loader which implements the Asynchronous Module Definition (AMD)
   * interface. This module loader provides the define and require globals, and 
   * the loader global for initial setup. 
   * 
   * The module loader implements a subset of features required by AMD, and 
   * thus fails the conformance tests required by AMD. Nevertheless, it is 
   * sufficient for use in simple web applications. 
   * 
   * The module loader supports loading JavaScript modules out of the box via
   * the 'js' and 'weak' plugins. JavaScript modules are normally loaded by the 
   * 'js' plugin, which is implemented by JsLoader. The 'weak' plugin is used 
   * only when breaking circular dependencies. 
   * 
   * Additional plugins may be used to load resource files besides JavaScript 
   * files. 
   * 
   * @desc Constructs an instance of the module loader. 
   * @author David He
   * 
   * @param {Object} options - The options to pass to the loader. The 
   *   recognized options are as follows:
   *
   *   jsBase {string=js/}
   *   The absolute or domain relative URL containing JavaScript files. 
   *   
   *   cssBase {string=css/}
   *   The absolute or domain relative URL containing Cascading Style Sheet files. 
   *   
   *   pluginBase {string=amd-plugins/}
   *   The URL containing loader plugins, relative to jsBase . By default, 
   *   the loader looks for loader plugins under the amd-plugins directory. 
   *   
   *   urlArgs {string=}
   *   A string that is appended to the end of an URL when retrieving a 
   *   resource. This can be used for cache busting. 
   *   
   *   alias {!Object={}}
   *   A set of aliases for JavaScript modules. The keys are aliases for the 
   *   values. 
   *   
   *   shim {!Object={}}
   *   Sets the dependencies and factory methods of JavaScript files which do 
   *   not use the AMD interface. The JavaScript file containing a shimmed 
   *   module is not retrieved until after the module's dependencies are 
   *   loaded. The dependencies of a shimmed module are specified here, and not 
   *   in its JavaScript file. 
   *   
   *   defineMode {string=eager}
   *   Whether to eagerly or lazily define modules. The AMD spec requires 
   *   defines to eagerly resolve dependencies and invoke the factory method 
   *   when done. However, it is useful for some web applications to only 
   *   resolve a module's dependencies when the module is being used by 
   *   another module. The value of this parameter, 'eager', or 'lazy', 
   *   determines how define operates. 
   *
   */
  var Core = function(options)
  {
    var self = this;
    this.jsBase = options.jsBase || 'js/';
    this.cssBase = options.cssBase || 'css/';
    this.pluginBase = options.pluginBase || 'amd-plugins/';
    this.urlArgs = options.urlArgs || '';
    this.alias = options.alias || {};
    this.shim = options.shim || {};
    this.defineMode = options.defineMode || 'eager';

    this.plugins = {};
    this.plugins.js = new JsLoader(this);
    
    this.plugins.weak = 
    {
      load: function(id) { return self.weakLoad(id); }
    };
  };

  Core.prototype = 
  {
    constructor: Core, 
    
    /**
     * Loads the specified module. 
     * @param {string} id - The ID of the module. 
     * @returns {!Promise} A promise that is resolved when the module loads. 
     */
    load: function()
    {
      var self = this;

      var id = this.parse.apply(this, arguments);
      
      return this.loadPlugin(id.pluginId)
        .then(function(plugin) {
          return plugin.load(id.resId, self);
        });
    }, 
    
    
    /**
     * Loads the specified loader plugin. 
     * @param {string} pluginId - The resource ID of the loader plugin. 
     * @returns {{load: function(string, Core):*}} The loader plugin. 
     */
    loadPlugin: function(pluginId)
    {
      var self = this;
      
      // memoize
      if (!(pluginId in this.plugins))
      {
        return this.load('js', this.pluginBase + pluginId)
          .done(function(plugin) {
            self.plugins[pluginId] = plugin;
          });
      }
      else
      {
        return Deferred.unit(this.plugins[pluginId]);
      }
    }, 

    /**
     * Weakly loads the specified JavaScript resource. Unlike strong loads, 
     * weak loads complete as soon as the file containing the module is 
     * loads. The factory to make the module may not yet run when this occurs. 
     * Weak loads are useful for breaking circular dependencies among modules. 
     * @param {string} id - The ID of the module. 
     * @returns {!Promise} A promise that resolves with the module context when 
     *   the script file containing the module loads. 
     */
    weakLoad: function(id)
    {
      var id = this.parse.apply(this, arguments);
      if (id.pluginId == 'js' || id.pluginId == 'weak')
      {
        var js = this.plugins.js;
        return js.getContext(id.resId).retrieve();
      }
      else
      {
        return this.load(id);
      }
    }, 
    
    /**
     * Parses a module ID into a paramatrized object. 
     * @param {*} moduleId - The module ID
     * @param {*} moduleId2 - The second part of an module ID
     * @returns {pluginId: string, resId: string} The paramatrized module ID. 
     *
     * @example The module ID 'css!common' is parsed to
     * 
     *   { pluginId: 'css', resId: 'common' } 
     * 
     * .
     */
    parse: function()
    {
      if (arguments.length == 0)
      {
        return {
          pluginId: 'js', 
          resId: undefined
        };
      }
      else if (arguments.length == 1 && typeof arguments[0] == 'object')
      {
        return arguments[0];
      }
      else if (arguments.length == 2)
      {
        return {
          pluginId: arguments[0], 
          resId: arguments[1]
        };
      }
      else // if (arguments.length == 1 && typeof arguments[0] == 'string')
      {
        var match = /^(\S+)!(\S+)$/.exec(arguments[0]);
        if (match != null)
        {
          return {
            pluginId: match[1], 
            resId: match[2]
          };
        }
        else
        {
          return {
            pluginId: 'js', 
            resId: arguments[0]
          };
        }
      }
    }
  };
  
  /**
   * Normalizes a resource ID by expanding out '.' and '..' paths. This method 
   * is not fully implemented. 
   * @param {string} id - The resource ID
   * @returns {string} The normalized resource ID. 
   */
  Core.normalize = function(id)
  {
    // relative ids are not supported
    return id;
  };

  /**
   * The js plugin loads JavaScript modules from JavaScript files. 
   * @param {!Core} The loader core. Options for this plugin are copied from the 
   *   core. 
   */
  var JsLoader = function(core)
  {
    this.core = core;
    this.contexts = {};
    this.urls = {};
    this.activeUrls = {};
    this.defines = [];
    this.defineMode = this.core.defineMode;
    
    // The require, exports, and module modules are provided by many other AMD 
    // loaders, but we do not implement them. 
    this.getContext('require').setModule({});
    this.getContext('exports').setModule({});
    this.getContext('module').setModule({});
    
    // Process shims. 
    for (var id in this.core.shim)
    {
      var shim = this.core.shim[id];
      var context = this.getContext(id);
      context.define(shim.deps, shim.factory);
      context.shim = true;
    }
  };
  
  JsLoader.prototype = 
  {
    constructor: JsLoader, 
    
    /**
     * The core loader. 
     * @type {!Core}
     */
    core: undefined, 
    
    /**
     * Contexts of named modules, keyed by the module name. 
     * @type {!Object<string, !JsLoader.Context>}
     */
    contexts: undefined, 
    
    /**
     * Promises of URLs. 
     * @type {!Object<string, !Promises>}
     */
    urls: undefined, 
    
    /**
     * The URLs which are currently being retrieved. 
     * @type {!Object<string, !JsLoader.Context>}
     */
    activeUrls: undefined, 
    
    /**
     * The define queue. 
     * @type {!Array<!Array>}
     */
    defines: undefined, 
    
    /**
     * Whether to eagerly or lazily define modules. Values are 'eager' or 
     *   'lazy'. 
     * @type {string}
     */
    defineMode: undefined, 
    
    /**
     * Loads the specified module from start to finish. 
     * @param {string} id - The resource ID of the module to load. 
     * @returns {!Promise} A promise that is resolved when the module is loaded. 
     */
    load: function(id)
    {
      return this.getContext(id).load();
    }, 

    /**
     * Returns the context of a module. If the context does not exist, one will 
     * be automatically created. 
     * @param {string} id - The resource ID of the module
     * @returns {!JsLoader.Context}
     */
    getContext: function(id)
    {
      id = Core.normalize(id);
      if (id === undefined || id == '_require')
      {
        return new JsLoader.Context(id, this);
      }
      else if (id in this.contexts)
      {
        return this.contexts[id];
      }
      else
      {
        return this.contexts[id] = new JsLoader.Context(id, this);
      }
    }, 

    /**
     * Resolves the URL from where a JavaScript module can be retrieved. 
     * @param {string} id - The resource ID of the module
     * @returns {string} an absolute URL
     */
    resolveUrl: function(id)
    {
      id = this.core.constructor.normalize(id);
      var url = this.core.jsBase 
        + (this.core.alias[id] || id) + '.js' 
        + this.core.urlArgs;
      
      // Convert relative URL to absolute URL if not a local file
      if (global.location.protocol != 'file:' 
        && !/^\w+:\/\//.test(url))
      {
        url = global.location.protocol + '//' + global.location.host + url;
      }
      
      return url;
    }, 
    
    /**
     * Defines a module with the specified id, dependencies, and factory. 
     * @param {string} id - The resource ID of the module
     * @param {Array.<string>} - The module dependencies of the module. 
     * @param {function} - The factory to create the module. 
     */
    define: function(id, deps, factory)
    {
      // IE8, IE9 doesn't fire onload immediately after the script completes, 
      // so it's not possible to determine the names of anonymous defines based 
      // on the module id used to retrieve the script after the script loads. 
      // Luckily, IE8 and IE9 provide a way to determine the active script 
      // during when the module is defined. We use the name of the active 
      // script for anonymous modules defines. Non-IE browsers cannot use this
      // mechanism because their script element skips the interactive state. 
      // 
      // This does not work in Opera so we explicitly avoid it. 
      if (id == undefined && !global.opera)
      {
        for (var url in this.activeUrls)
        {
          var context = this.activeUrls[url];
          if (context.scriptElem.readyState == 'interactive')
          {
            id = context.id;
          }
        }
      }

      var active = false;
      for (var url in this.activeUrls) { active = true; break; }
      if (active)
      {
        // The defines queue is used primarily used by non-IE browsers that do 
        // not have an interactive readyState for script elements. IE browsers 
        // cannot use this mechanism because their onload is not guaranteed to 
        // fire immediately after a script loads. IE browsers uses the 
        // readyState mechanism instead. 
        this.defines.push(arguments);
      }
      else
      {
        var context = this.getContext(id);
        context.define(deps, factory);
      }
    }, 
    
    /**
     * Defines a module without a name, and makes the module. 
     * @param {Array.<string>} - The module dependencies of the module. 
     * @param {function} - The factory to create the module. 
     */
    require: function(deps, factory)
    {
      this.define('_require', deps, factory);
    }
  };
  
  /**
   * Structure tracking the loading of a JavaScript module. 
   * @param {string} id - The resource ID of the module. 
   * @param {!JsLoader} loader - The JavaScript loader plugin. 
   */
  JsLoader.Context = function(id, loader)
  {
    this.id = id;
    this.loader = loader;
    this.core = loader.core;
    
    this.state = 'init';
    this.dfd = new Deferred();
    this.weakDfd = new Deferred();
    
    this.url = this.loader.resolveUrl(this.id);
  };

  JsLoader.Context.prototype = 
  {
    constructor: JsLoader.Context, 
    
    
    /**
     * The resource ID of the module to load. 
     * @type {string}
     */
    id: undefined, 
    
    /**
     * The JavaScript module loader plugin to which this context belongs. 
     * @type {!Loader}
     */
    loader: undefined, 
    
    /**
     * The core module loader. 
     * @type {!Core}
     */
    core: undefined, 
    
    /*
      The state of loading the module. The states are: 
        
        init         The initial state. 
        
        retrieving   Retrieving the script containing the module. 
        
        retrieved    The script finished loading. 
        
        defined      The dependencies and factory of the module are defined. 
                     At this point, the weakDfd is resolved. 
                     
        depending    Waiting for the dependencies to load. 
        
        making       Executing the factory of the module. 
        
        complete     The module is built by the factory. This is a terminal 
                     state. 
                     At this point, the module is fully loaded and the (strong) 
                     promise is resolved. 
                     
        failed       One of the above steps failed. This is a terminal state. 
        
    * @type {string}
    */
    state: 'init', 
    
    /**
     * The deferred that is resolved when the module loads. 
     * @type {!Deferred}
     */
    dfd: undefined, 
    
    /**
     * The deferred that is resolved when the module is defined. 
     * @type {!Deferred}
     */
    weakDfd: undefined, 
    
    /**
     * The domain relative URL of the JavaScript file containing the module. 
     * @type {string}
     */
    url: undefined, 
    
    /**
     * Retrieves the JavaScript file containing this module. 
     * @returns {!Promise} A promise that is resolved when the module is 
     *   defined. 
     */
    retrieve: function()
    {
      var self = this;

      if (this.id == undefined)
      {
        throw new Error('Can\'t resolve anonymous contexts');
      }
      
      // Quit if module is already retrieving or if already retrieved
      if (this.state != 'init')
      {
        return this.weakDfd.promise();
      }
      this.state = 'retrieving';
      
      // Check if the JavaScript file containing the module is already 
      // retrieving or if already retrieved
      var promise = this.loader.urls[this.url];
      if (promise === undefined)
      {
        promise = this.loader.urls[this.url] = this.retrieveScript();
        promise.originId = this.id;
      }
      
      promise
        .always(function() {
          if (self.state == 'retrieving')
          {
            self.state = 'retrieved';
          }
        })
        .done(function() {
          // Process all defines in the define queue. This mechanism is used 
          // primarily by non-IE browsers, but is sometimes be used on IE. 
          var args;
          while (args = self.loader.defines.shift())
          {
            var id = args[0] || self.id;
            var context = self.loader.getContext(id);
            Array.prototype.shift.call(args);
            context.define.apply(context, args);
          }
          
          // If the module was not defined in the JavaScript file, assume that 
          // this was intentional (because the JavaScript file does not use the 
          // AMD interface, etc)
          if (self.state == 'retrieved')
          {
            self.setModule(undefined);
          }
        })
        .fail(function() {
          self.state = 'failed';
          self.weakDfd.reject();
          self.dfd.reject();
        });

      return this.weakDfd.promise();
    }, 
    
    /**
     * Defines the dependencies of this module and the factory to construct 
     * this module. 
     * @param {Array.<string>} deps - The dependencies
     * @param {fucntion():*} factory - The factory
     */
    define: function(deps, factory)
    {
      var self = this;
      if (this.state == 'defined' || this.state == 'complete')
      {
        throw new Error('Module already defined: ' + this.id);
      }

      this.deps = deps || ['require', 'exports', 'module'];
      this.factory = typeof factory == 'function' ? factory : function() { return factory; };
      this.state = 'defined';
          
      this.weakDfd.resolve(self);
      
      // Proceed to make the module if modules are eagerly defined, or if the 
      // module was called from require() instead of define(). 
      if (this.loader.defineMode == 'eager' 
        || this.id == '_require')
      {
        this.make();
      }
    }, 
    
    /**
     * Makes the module by resolving its dependencies and then invoking its 
     * factory. This method does nothing if the module has not been defined, 
     * is being made, or has already been made. 
     * @returns {!Promise} A promise that is resolved when the module is 
     *   created. 
     */
    make: function()
    {
      var self = this;
      if (this.state != 'defined')
      {
        return;
      }
      
      // Load dependencies
      this.state = 'depending';
      var modules;
      var promise = Deferred.when.apply(undefined, 
        this.deps.map(self.core.load.bind(self.core))
        )
        .done(function() {
          modules = arguments;
        });
      
      // If this module is shimmed, retrieve its containing script after all 
      // its dependencies load
      if (this.shim)
      {
        promise = promise.then(this.retrieveScript.bind(this));
      }
      
      promise
        .done(function() {
          self.state = 'making';
          // Create module by running its factory
          self.setModule(self.factory.apply(global, modules));        
        })
        .fail(function() {
          self.state = 'failed';
          self.weakDfd.reject();
          self.dfd.reject();
        });
    }, 
    
    /**
     * Loads this module. 
     * @returns {!Promise} A promise that resolves the module when the module is 
     *   fully loaded. 
     */
    load: function()
    {
      this.retrieve()
        .done(this.make.bind(this));
      return this.promise();
    }, 
    
    /**
     * Sets the module. 
     */
    setModule: function(module)
    {
      this.module = module;
      this.state = 'complete';
      this.weakDfd.resolve(self);
      this.dfd.resolve(module);
    }, 
    
    /**
     * Returns a promise that is resolved when the module loads. 
     * @returns {!Promise}
     */
    promise: function()
    {
      return this.dfd.promise();
    }, 

    /**
     * Retrieves and loads a JavaScript file by inserting a <script> element 
     * whose src attribute points to the URL of the file. 
     * @returns {!Promise} A promise that is resolved when the script finishes 
     *   loading. 
     */
    retrieveScript: function()
    {
      var self = this;
      var dfd = new Deferred();

      var elem = this.scriptElem = document.createElement('script');
      elem.src = this.url;
      elem.type = 'text/javascript';
      elem.async = true;

      elem.onload = function(event)
      {
        if (event.type == 'load')
        {
          dfd.resolve();
        }
      };

      elem.onreadystatechange = function()
      {
        if (!('addEventListener' in global) 
          && (elem.readyState == 'loaded' || elem.readyState == 'complete'))
        {
          dfd.resolve();
        }
      };

      elem.onerror = function() 
      {
        dfd.reject();
      };
      
      this.loader.activeUrls[this.url] = this;

      var head = document.getElementsByTagName('head')[0];
      head.appendChild(elem);

      var promise = dfd.promise();
      promise.elem = elem;

      promise.always(function() {
        delete self.loader.activeUrls[self.url];
        elem.onload = elem.onreadystatechange = elem.onerror = '';
      });
      return promise;
    }
  };

  // The singleton Core instance. This instance will be initialized in 
  // loader.setup .
  core = Object.create(Core.prototype);
  
  // Global define, as required by the AMD spec.
  global.define = function()
  {
    while (arguments.length != 3)
    {
      Array.prototype.unshift.call(arguments, undefined);
    }
    
    var js = core.plugins.js;
    js.define.apply(js, arguments);
  };
  
  // So modules know that a script loader is present. 
  global.define.amd = { jQuery: {} };
  
  // Global require. Not required by the AMD spec, but is supported by most loaders. 
  global.require = function()
  {
    while (arguments.length != 2)
    {
      Array.prototype.unshift.call(arguments, undefined);
    }

    var js = core.plugins.js;
    js.require.apply(js, arguments);
  };
  
  // Export the singleton core instance as a global. 
  global.loader = core;
  global.loader.setup = function(options)
  {
    Core.call(core, options);
    
    global.define('loader', [], function() {
      return this.loader;
    });
  };
  
})();
