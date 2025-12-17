//----------------------------------------------------
// Copyright 2021-2022 Epic Systems Corporation
//----------------------------------------------------
// TITLE:   Console.js
// PURPOSE: Contains client-side javascript for Warehouse Console Architecture
// AUTHOR:  David He
// REVISION HISTORY:
//   *crr 10/2021 783906 - Add error messages for Quiet Window
//   *amb 11/2021 829944 - Add ViewActiveServiceCaches to Resolvers
//   *crr 06/2022 891677 - Add InstallXML
//   *amb 06/2022 890287 - Add bulk script gen
//   *amb 07/2022 885459 - Add addInsertableTagsToTargetText
//   *cep 07/2023 1001859 - Remove unsupported browser banner handling
//---------------------------------------------------------------------

define(
    ['jquery', 'modernizr', 'Utils',
        'jquery.validate', 'jquery.mousewheel'],
    function ($, Modernizr, Utils) 
    {
        var global = this;
        var window = this;
        var document = global.document;
        var Deferred = Utils.Deferred;

        var Console = {};
        var ConsoleNav;
        /**
         * Singleton class for the data warehouse console application. 
         * Console.instance is the sole instance of this class. 
         * 
         * @param {?string} baseUrl - The domain relative URL of the console 
         *   application. For example, if the VisitFact dictionary entry is located 
         *   at 
         *   
         *     http://www.example.com/warehouse/tables/VisitFact
         *   
         *   , then the baseUrl is 
         *   
         *     warehouse/
         *   
         *   .
         * 
         * @mixes Console.Layers
         */
        Console.App = function (baseUrl)
        {
            var self = this;
            $.extend(this, Console.Layers.prototype);
            Console.Layers.call(this);
            var $document = $(document);
            var $html = $document.children('html');

            if (Utils.Browser.chrome())
            {
                $html.addClass('chrome');
            }
            else if (Utils.Browser.firefox())
            {
                $html.addClass('firefox');
            }

            this.baseUrl = baseUrl || '';
            this.isStatic = $html.hasClass('static');
            this.useHistory = Modernizr.history && !this.isStatic;

            this.activityName = $html.attr('data-activity-name');
            this.groupName = $html.attr('data-group-name');

            this.loadLasts();

            // Load the activity
            require(['activities/' + this.activityName, 'ConsoleNav'],
                function (ns, _ConsoleNav)
                {

                    ConsoleNav = _ConsoleNav;

                    self.activity = Object.create(ns.Activity.prototype);
                    ns.Activity.call(self.activity);

                    self.activity.elem.removeClass('loading');
                    self.activity.updateLayout();
                    self.activity.updateScroll();

                    var pageDesc = {};
                    self.resolve(pageDesc);
                    pageDesc.absoluteUrl = window.location.href;
                    self.saveLasts(pageDesc);
                    self.nav.update();

                    // Push the current page onto the history stack
                    if (self.useHistory)
                    {
                        window.history.replaceState({ pageDesc: pageDesc }, document.title, pageDesc.absoluteUrl);
                    }

                    window.history.ready = true;
                });

            // Set up compatibility for IE8, IE9, IE10
            this._setupIeCompat();

            // Set up jQuery validation
            this.setupValidation();

            // Initialize the history API if supported by the browser
            if (this.useHistory)
            {
                // Process history changes by loading pages asynchronously
                $(window).on('popstate.console', function (event)
                {
                    var state = event.originalEvent.state;
                    if (window.history.ready !== true)
                    {
                        return;
                    }

                    if (state !== null && 'pageDesc' in state)
                    {
                        $html.addClass('progress');
                        self.loadPage(state.pageDesc, 'none')
                            .always(function ()
                            {
                                $html.removeClass('progress');
                            });
                    }
                });
            }

            // Jump to next variable when press F2
            $document.on('keydown.console', function (event)
            {
                var target = $(event.target);
                if (target.is('textarea')
                    && event.keyCode === 113 // F2
                )
                {
                    var linkRegexp = /^Link="[^"]+", Text="[^"]+"$/;
                    var executeRegexp = /^EXECUTE (.)+$/;
                    var text = target[0].value;
                    var cycle, searchStart, variableIndex, linkText, leftDelimiterIndex, rightDelimiterIndex;
                    var done = false;
                    cycle = false;
                    searchStart = target[0].selectionEnd;
                    while (!done)
                    {
                        variableIndex = text.indexOf("***", searchStart);
                        if (variableIndex === -1 && !cycle)
                        {
                            variableIndex = text.indexOf("***");
                            cycle = true;
                        }
                        if (variableIndex === -1)
                        {
                            done = true;
                        }
                        else
                        {
                            // check if the *** is within link brackets
                            var textToVariable = text.substring(0, variableIndex);
                            var leftDelimiterMatch = textToVariable.match(/<<\s*(Link|EXECUTE)/gi);
                            var isMatchLink = leftDelimiterMatch && leftDelimiterMatch.length && (leftDelimiterMatch[0].indexOf('Link') > -1);
                            var matchTextLength = isMatchLink ? 4 : 7;
                            leftDelimiterIndex = leftDelimiterMatch ? (textToVariable.lastIndexOf(leftDelimiterMatch[leftDelimiterMatch.length - 1]) + leftDelimiterMatch[leftDelimiterMatch.length - 1].length - matchTextLength) : -1;
                            var textAfterVariable = text.substring(variableIndex);
                            var rightDelimiterMatch = textAfterVariable.match(/\s*>>/gi);
                            rightDelimiterIndex = rightDelimiterMatch ? (variableIndex + textAfterVariable.indexOf(rightDelimiterMatch[0])) : -1;
                            linkText = text.substring(leftDelimiterIndex, rightDelimiterIndex);
                            if (linkText.match(linkRegexp) || linkText.match(executeRegexp) || target.hasClass('wildcard'))
                            {
                                target[0].selectionStart = variableIndex;
                                target[0].selectionEnd = variableIndex + 3;
                                done = true;
                            }
                            else
                            {
                                searchStart = variableIndex + 3;
                            }
                        }
                        if (cycle && searchStart > target[0].selectionEnd)
                        {
                            done = true;
                        }
                    }
                }
            });

            // Prevent backspace from performing navigation in readonly input fields
            $document.on('keydown.console', function (event)
            {
                var target = $(event.target);
                if (target.is('input[type=text], input[type=password], textarea')
                    && target.prop('readonly')
                    && event.keyCode === 8 // Backspace
                )
                {
                    event.preventDefault();
                }
            });


            // Close dialog on escape
            $document.on('keydown.console-dialog', function (event)
            {
                if (event.keyCode === 27   // Escape
                    && self.topLayer.hasClass('content-layer'))
                {
                    // Locate the dialog of the top most layer
                    var app = Console.instance;
                    var dialogs = app.activity.dialogs;
                    var dialog = Utils.find.call(dialogs,
                        function (dialog)
                        {
                            return dialog.elem.closest(self.topLayer).length !== 0;
                        });

                    // If it exists, close it
                    if (dialog)
                    {
                        event.preventDefault();
                        dialog.close();
                    }
                }
            });

            // Close submenu on escape and clear submenu timeout
            $document.on('keydown.console-nav-submenu', function (event)
            {
                if (event.keyCode === 27)   // Escape
                {
                    event.preventDefault();
                    $(event.target).blur();
                    $(event.target).closest('.activity-group').removeClass('show');
                    var app = Console.instance;
                    if (app.consoleNavSubmenuFocusTimeout)
                    {
                        clearTimeout(app.consoleNavSubmenuFocusTimeout);
                    }
                }
            });

            //HOTKEYS
            $document.on('keydown.console', function (event)
            {
                var keyCode = event.keyCode || event.which;
                //Check if event is Alt+Shift+<key charcter between a(keycode:65) and z(keycode:90)>
                if (event.altKey
                    && event.shiftKey
                    && keyCode >= 65 && keyCode <= 90)
                {
                    event.preventDefault();
                    event.stopPropagation();
                    var accessKey = String.fromCharCode(keyCode).toUpperCase();
                    if (Utils.isAccessKeyAllowed(accessKey))
                    {
                        //Find DOM elements having the access-key attribute with the specified value
                        var accessKeyElements = self.topLayer.find("[access-key]").filter(function ()
                        {
                            return (this.getAttribute('access-key').toUpperCase() == accessKey) && $(this).is(':visible');
                        });

                        var accessKeyElement;
                        if (accessKeyElements !== undefined)
                        {
                            // Pick the access key element which is closest from the currently active element if there are more than 1 DOM elements having the access-key attribute with the specified value
                            if (accessKeyElements.length > 1)
                            {
                                var activeElem = document.activeElement;
                                if (activeElem === undefined)
                                {
                                    accessKeyElement = accessKeyElements[0];
                                }
                                else
                                {
                                    var closestAccessKeyElem = accessKeyElements[0];
                                    var closestDistance = Utils.distanceBetweenElems(activeElem, closestAccessKeyElem);
                                    var tempElem;
                                    var tempDistance;
                                    for (var i = 1; i < accessKeyElements.length; i++)
                                    {
                                        tempElem = accessKeyElements[i];
                                        tempDistance = Utils.distanceBetweenElems(activeElem, tempElem);
                                        if (closestDistance > tempDistance)
                                        {
                                            closestAccessKeyElem = tempElem;
                                            closestDistance = tempDistance;
                                        }
                                    }
                                    accessKeyElement = closestAccessKeyElem;
                                }
                            }
                            else
                            {
                                accessKeyElement = accessKeyElements[0];
                            }

                            var action = accessKeyElement.getAttribute('access-key-action');

                            if (action)
                            {
                                switch (action.toUpperCase())
                                {
                                    case "FOCUS":
                                        if ($(accessKeyElement).is(':focus'))
                                        {
                                            accessKeyElement.blur();// Blur if already focussed: can be used to close submenus
                                        }
                                        else
                                        {
                                            accessKeyElement.focus();
                                            var app = Console.instance;
                                            if (app.consoleNavSubmenuFocusTimeout)
                                            {
                                                clearTimeout(app.consoleNavSubmenuFocusTimeout);
                                            }
                                            //timeout of 8 sec: used to close submenus after the interval
                                            app.consoleNavSubmenuFocusTimeout = setTimeout(function (accessKeyElement) 
                                            {
                                                accessKeyElement.blur();
                                            }, 8000, accessKeyElement);
                                        }
                                        break;

                                    case "CLICK":
                                        accessKeyElement.click();
                                        break;

                                    default:
                                        break;
                                }
                            }
                        }
                    }
                }
            });

            for (var field in $.validator.messages)
            {
                if ($.validator.messages.hasOwnProperty(field))
                {

                    var message = $.validator.messages[field];

                    if (message && message.indexOf && message.indexOf('.', message.length - 1) !== -1)
                    {
                        $.validator.messages[field] = message.substring(0, message.length - 1);
                    }
                }
            }
        };

        Console.App.prototype =
        {
            constructor: Console.App,

            /**
             * The URL of the console relative to the domain name. 
             * 
             * For example, if the AllergyFact table entry is
             * 
             *     http://www.example.com/warehouse/tables/AllergyFact 
             * 
             * , then the baseUrl is 
             * 
             *     warehouse/ 
             * 
             * .
             * @type string
             */
            baseUrl: undefined,

            /**
             * The name of the activity. This is the internal name, not the display 
             * name. 
             * @type string
             */
            activityName: undefined,

            /**
             * The currently running activity. 
             * @type Console.Activity
             */
            activity: null,

            /**
             * The console level navigation. 
             * @type {!ConsoleNav}
             */
            nav: undefined,

            /**
             * Counter for generating unique IDs
             * @type {number}
             */
            autoIdCounter: 0,

            /**
             * Destroys this Console instance. This should be called when the 
             * beforeonload event is fired. 
             */
            destroy: function ()
            {
                // This forces Console.request to make requests synchronously on IE and Firefox. 
                this.isUnloading = true;

                if (this.activity)
                {
                    this.activity.destroy();
                }

                this._teardownIeCompat();

                $(window).off('.console');
                $(document).off('.console');

                this.destroyLayers();

                this.isUnloading = false;
            },

            /**
             * Loads the properties of historical page descriptors. 
             */
            loadLasts: function ()
            {
                if (Modernizr.sessionstorage)
                {
                    this.lasts = $.parseJSON(sessionStorage.getItem('lasts')) || {};
                }
                else
                {
                    this.lasts = {};
                }
            },

            /**
             * Saves a page descriptor into the browsing session history, for use in 
             * resolving page descriptors in the future. 
             * @param {PageDesc} pageDesc - The page descriptor to save
             */
            saveLasts: function (pageDesc)
            {
                this.lasts[pageDesc.groupName] = $.extend(this.lasts[pageDesc.groupName], { activityName: pageDesc.activityName });
                this.lasts[this.activityName] = $.extend(this.lasts[this.activityName], pageDesc);
                if (Modernizr.sessionstorage)
                {
                    sessionStorage.setItem('lasts', JSON.stringify(this.lasts));
                }
            },

            /**
             * Resolves a property of a page descriptor by querying the current 
             * activity and querying the history of the current browsing session. 
             * @param {!PageDesc} pageDesc - The page descriptor
             * @param {string} propName - The name of the property to resolve
             * @returns {*} The resolved value of the property, if it was able to be 
             *   resolved
             */
            resolveProperty: function (pageDesc, propName)
            {
                if (pageDesc[propName])
                {
                    return pageDesc[propName];
                }
                else if (this.activityName === pageDesc.activityName
                    && this.activity[propName])
                {
                    return this.activity[propName];
                }
                else if ((this.activityName === pageDesc.activityName) && this.activity.page && this.activity.page.elem && this.activity.page.elem.length)
                {
                    var elem = this.activity.page.elem[0];
                    var length = elem.attributes.length;
                    for (var i = 0; i < length; i++)
                    {
                        var attr = elem.attributes[i];
                        if (attr.name.lastIndexOf('data-', 0) === 0)
                        {
                            var propNameCurrent = $.camelCase(attr.name.substring(5));
                            if ((propNameCurrent === propName) && attr.value)
                            {
                                return attr.value;
                            }
                        }
                    }
                }
                else if (this.lasts[pageDesc.activityName]
                    && this.lasts[pageDesc.activityName][propName])
                {
                    return this.lasts[pageDesc.activityName][propName];
                }
                else
                {
                    return undefined;
                }
            },

            /**
             * Resolves the URL and other properties of a page descriptor. 
             * @param {!PageDesc} pageDesc - The page descriptor, which is a 
             *   parametarization of the URL. 
             * @returns {string} The URL of the page descriptor
             */
            resolve: function (pageDesc)
            {

                // Assume that the page descriptor is already resolved if the absoluteUrl 
                // property is present. 
                if ('absoluteUrl' in pageDesc)
                {
                    return pageDesc.absoluteUrl;
                }

                pageDesc.activityName = this.resolveActivityName(pageDesc);

                // Resolve other properties in the page descriptor via activity specific resolvers
                Console.Resolvers[pageDesc.activityName].call(this, pageDesc);

                // Convert the application relative URL to an absolute URL
                pageDesc.absoluteUrl = Utils.toAbsoluteUrl(this.baseUrl + pageDesc.url);
                return pageDesc.absoluteUrl;
            },

            /**
             * Resolves the activity name of a page descriptor. 
             * @private
             * @param {PageDesc} pageDesc - The page descriptor
             * @returns {string} The activity name
             */
            resolveActivityName: function (pageDesc)
            {
                var prop = pageDesc.activityName;
                if (prop) return prop;

                // Try computing from the navigation group
                if (pageDesc.groupName)
                {
                    // Use last visited activity if available
                    prop = this.lasts[pageDesc.groupName]
                        && this.lasts[pageDesc.groupName].activityName;
                    if (prop) return prop;

                    var navSection = $('.console-nav [data-group-name="' + pageDesc.groupName + '"]');

                    if (navSection.find('[data-activity-name="' + pageDesc.activityName + '"]').length === 0)
                    {
                        pageDesc.activityName = navSection.find('[data-activity-name]').attr('data-activity-name');
                    }

                    switch (pageDesc.groupName)
                    {
                        case 'Dictionary': return 'Dictionary';
                        case 'ClarityTablesByApp': return 'ClarityTablesByApp';
                        case 'DictionaryEditor': return 'DictionaryEditor';
                        case 'Executions': return 'Executions';
                        case 'WorkQueue': return 'WorkQueue';
                        case 'KitApps': return 'KitApps';
                        case 'ResourceGovernor': return 'ResourceGovernor';
                        case 'Configuration':
                            return navSection.find('[data-activity-name]').attr('data-activity-name');
                        case 'Tools':
                            return navSection.find('[data-activity-name]').attr('data-activity-name');
                    }
                }

                // Use the current activity name as fallback
                return this.activityName;
            },

            /**
             * Loads the page specified by the page descriptor. The page to load 
             * replaces the current page. 
             * 
             * This method devloves the implementation of loading the page to the 
             * currently running activity. 
             * 
             * @param {!PageDesc} pageDesc - The page descriptor. 
             * @param {string=push} historyMode - Where to place the new page on the 
             *   history stack.  Must be push, replace, or none. 
             * @returns {!Promise} - A promise resolving the new page. 
             */
            loadPage: function (pageDesc, historyMode)
            {
                var self = this;
                historyMode = historyMode || 'push';

                this.resolve(pageDesc);

                // Devolve implementation to the currently running activity
                return this.activity.loadPageHelper(pageDesc)
                    .done(function (page, props)
                    {
                        // Replace title
                        document.title = props && props.title;

                        self.saveLasts(pageDesc);
                        self.activity.updateLayout();
                        self.nav.update();

                        // Add history entry for browsers which support it
                        if (self.useHistory)
                        {
                            window.history.ready = true;
                            if (historyMode === 'push')
                            {
                                window.history.pushState({ pageDesc: pageDesc }, document.title, pageDesc.absoluteUrl);
                            }
                            if (historyMode === 'replace')
                            {
                                window.history.replaceState({ pageDesc: pageDesc }, document.title, pageDesc.absoluteUrl);
                            }
                        }
                    });
            },

            /**
             * Sets up global handlers for IE compatibility. 
             */
            _setupIeCompat: function ()
            {
                /* Detect IE10 using conditional compilation */
                if (/*@cc_on!@*/false && document.documentMode === 10)
                {
                    $(document.html).addClass('ie10');
                }

                this._setupIeCompatReturn();
                this._setupIeCompatActiveAndFocus();
                this._setupIeCompatHover();
            },

            _setupIeCompatReturn: function ()
            {
                /* 
                 * Pressing enter on an input element in IE8, IE9, and IE10 triggers a 
                 * form submission even if the input element does not belong to a form. 
                 * We detect when this is about to occur and prevent IE from triggering 
                 * the click. 
                 */
                $(document).on('keydown.console-ie-compat, keyup.console-ie-compat',
                    'input', function (event)
                {
                    if (event.keyCode === 13) // Enter
                    {
                        event.preventDefault();
                    }
                });
            },

            _setupIeCompatActiveAndFocus: function ()
            {
                /* Workarounds for: 
                 *   - IE8, IE9, and IE10 do not mark :active for an element if one of 
                 *     its descendents is moused down. 
                 *     
                 *       We work around this behavior for focusable elements only. If an 
                 *       descendent of a focusable element is moused down, we add the 
                 *       .active CSS class to the focusable element. 
                 *   
                 *   - IE8 and IE9 do not clear :active for <a> and <button> if the mouse 
                 *     is not over the active element. 
                 *       
                 *       This behavior occurs when IE thinks we are attempting to drag 
                 *       the <a> or <button>. We prevent the drag by invoking 
                 *       preventDefault() for the mouse down event. On IE8, we 
                 *       additionally preventDefault() for the mouse over event. 
                 *       
                 *   - IE8, IE9, and IE10 focuses <a> and <button> on click. 
                 *       
                 *       For IE9 and IE10, we call event.preventDefault() on the 
                 *       mousedown event to prevent focusing the element. For IE8, we do 
                 *       not prevent focusing the element. 
                 */
                $(document).on('mousedown.console-ie-compat', function (event)
                {
                    var target = $(event.target);
                    var focusable = $();
                    if (!target.is(':focusable'))
                    {
                        focusable = target.closest(':focusable');
                        if (focusable.length)
                        {
                            focusable.addClass('active');

                            $(document).one('mouseup.console-ie-compat', function (event)
                            {
                                focusable.removeClass('active');
                            });
                        }
                    }

                    else if (target.is('a, button'))
                    {
                        focusable = target;
                    }

                    if (focusable.length)
                    {
                        event.preventDefault();

                        // IE8 also requires preventDefault on mousemove 
                        if ($(document.html).hasClass('lt-ie9'))
                        {
                            $(document).on('mousemove.console-ie-compat', function (event)
                            {
                                event.preventDefault();
                            });

                            $(document).on('mouseup.console-ie-compat', function (event)
                            {
                                $(document).off('mousemove.console-ie-compat');
                            });
                        }
                    }
                });
            },

            _setupIeCompatHover: function ()
            {
                /* 
                 * IE8 and IE9 do not support :hover for <select> elements. We fix this 
                 * by setting the .hover CSS class between mouseenter and mouseleave 
                 * events.  
                 */
                if ($(document.html).hasClass('lt-ie10'))
                {
                    $(document).on('mouseenter.console-ie-compat', 'select', function (event)
                    {
                        $(event.target).addClass('hover');
                    });

                    $(document).on('mouseleave.console-ie-compat', 'select', function (event)
                    {
                        $(event.target).removeClass('hover');
                    });
                }
            },

            /*
             * Removes handlers installed by setupIeCompat(). 
             */
            _teardownIeCompat: function ()
            {
                $(document).off('.console-ie-compat');
            },

            /**
             * Set up default options for jQuery validation
             */
            setupValidation: function ()
            {
                // TODO fix this with $.extend($.validator.messages, ...)
                $.validator.setDefaults({
                    // Remove 'please' and periods from the messages shipped by jquery-validation
                    messages:
                    {
                        required: 'This field is required',
                        remote: 'Fix this field',
                        email: 'Enter a valid email address',
                        url: 'Enter a valid URL',
                        date: 'Enter a valid date',
                        dateISO: 'Enter a valid date (ISO)',
                        number: 'Enter a valid number',
                        digits: 'Enter only digits',
                        creditcard: 'Enter a valid credit card number',
                        equalTo: 'Enter the same value again',
                        maxlength: $.validator.format('Enter no more than {0} characters'),
                        minlength: $.validator.format('Enter at least {0} characters'),
                        rangelength: $.validator.format('Enter a value between {0} and {1} characters long'),
                        range: $.validator.format('Enter a value between {0} and {1}'),
                        max: $.validator.format('Enter a value less than or equal to {0}'),
                        min: $.validator.format('Enter a value greater than or equal to {0}')
                    }
                });
            },

            /**
             * Returns the width in pixels of the browser provided scroll bar. 
             * 
             * This is used when opening a dialog replaces the scrollbar with dead 
             * space. 
             * @return {number}
             */
            getScrollBarWidth: function ()
            {
                // memoize
                if (!('_scrollBarWidth' in this))
                {
                    var indicator = $(document.createElement('div'))
                        .css({
                            width: '100px',
                            height: '100px',
                            overflow: 'scroll'
                        })
                        .appendTo($(document.body));
                    this._scrollBarWidth = indicator.innerWidth() - indicator[0].clientWidth;
                    indicator.remove();
                }
                return this._scrollBarWidth;
            },

            /**
             * Returns an unique ID. 
             * @returns {number} The unique ID
             */
            autoId: function ()
            {
                return 'auto_' + (this.autoIdCounter += 1);
            }
        };

        Console.instance = Object.create(Console.App.prototype);


        /**
         * Activity specific page descriptor resolvers. Each resolver determines the 
         * URL and other properties of a page descriptor from the current context. 
         * These resolves are used by Console.App.prototype.resolve . This is a 
         * object whose keys are activity names and whose values are resolvers. 
         * @type {Object.<string, function(!PageDesc)>}
         */
        Console.Resolvers =
        {
            Dictionary: function (pageDesc)
            {
                var getTableName = (function ()
                {
                    if (pageDesc.tableName)
                    {
                        return pageDesc.tableName;
                    }

                    if (this.activityName === 'Dictionary'
                        && this.activity.tableName)
                    {
                        return this.activity.tableName;
                    }

                    var etl;
                    if (this.activityName === 'DictionaryEditor'
                        && this.activity.etlName)
                    {
                        etl = this.activity.etls[this.activity.etlName];
                    }
                    if (etl && etl.Load && etl.Enabled && !etl.Hidden)
                    {
                        //if the last Dictionary etl name was the same as the Dictionary Editor etl name, 
                        //return the last Dictionary table name
                        if (this.lasts && this.lasts.Dictionary && this.lasts.Dictionary.etlName === this.activity.etlName)
                        {
                            return this.lasts.Dictionary.tableName;
                        }
                        return this.activity.etlName;
                    }

                    if (this.lasts && this.lasts.Dictionary && this.lasts.Dictionary.tableName)
                    {
                        return this.lasts.Dictionary.tableName;
                    }

                    return undefined;
                }).bind(this);

                var getEtlName = (function ()
                {
                    if (pageDesc.etlName)
                    {
                        return pageDesc.etlName;
                    }

                    if (this.activityName === 'Dictionary' && this.activity.etlName)
                    {
                        return this.activity.etlName;
                    }

                    var etl;
                    if (this.activityName === 'DictionaryEditor'
                        && this.activity.etlName)
                    {
                        etl = this.activity.etls[this.activity.etlName];
                    }
                    if (etl && etl.Load && etl.Enabled && !etl.Hidden)
                    {
                        return this.activity.etlName;
                    }

                    //try to compute correct etl name from table name
                    if (this.activityName === 'Dictionary' && pageDesc.tableName)
                    {
                        var tableName = pageDesc.tableName;
                        for (var etlName in this.activity.etls)
                        {
                            var tableNames = this.activity.etls[etlName];
                            for (var i = 0; i < tableNames.length; i++)
                            {
                                if (tableNames[i] === tableName)
                                {
                                    return etlName;
                                }
                            }
                        }
                    }

                    if (this.lasts && this.lasts.Dictionary && (etl === undefined || (!etl.Enabled && etl.Name === this.lasts.Dictionary.tableName)))
                    {
                        return this.lasts.Dictionary.etlName;
                    }
                    return undefined;
                }).bind(this);



                pageDesc.groupName = 'Dictionary';
                pageDesc.pageName = this.resolveProperty(pageDesc, 'pageName') || 'Table';
                switch (pageDesc.pageName)
                {
                    case 'ErDiagrams':
                        pageDesc.tableName = getTableName();
                        pageDesc.etlName = getEtlName();
                        pageDesc.groupName = 'Dictionary';
                        pageDesc.url = 'ErDiagrams/' + (pageDesc.tableName || 'none');
                        break;

                    case 'Table':
                        pageDesc.tableName = getTableName();
                        pageDesc.etlName = getEtlName();
                        pageDesc.groupName = 'Dictionary';
                        pageDesc.url = 'tables/' + (pageDesc.tableName || 'none');
                        break;
                }
            },

            ClarityTablesByApp: function (pageDesc)
            {
                pageDesc.groupName = 'ClarityTablesByApp';
                pageDesc.url = 'clarityTablesByApp';
            },

            DictionarySearch: function (pageDesc)
            {
                pageDesc.groupName = 'DictionarySearch';
                pageDesc.url = sessionStorage ? sessionStorage.getItem('lastDictionarySearchUrl') || 'search' : 'search';
            },

            DictionaryEditor: function (pageDesc)
            {
                var self = this;

                // Determines the ETL name
                var getEtlName = function ()
                {
                    if (pageDesc.etlName)
                    {
                        return pageDesc.etlName;
                    }

                    else if (self.activityName === 'DictionaryEditor'
                        && self.activity.etlName)
                    {
                        return self.activity.etlName;
                    }

                    else if (self.activityName === 'Dictionary'
                        && self.activity.etlName)
                    {
                        return self.activity.etlName;
                    }

                    else if (self.lasts && self.lasts.DictionaryEditor
                        && self.lasts.DictionaryEditor.etlName)
                    {
                        return self.lasts.DictionaryEditor.etlName;
                    }

                    else
                    {
                        return undefined;
                    }
                };

                var getViewName = function ()
                {
                    var etl;
                    if (pageDesc.viewName)
                    {
                        return pageDesc.viewName;
                    }

                    else if (self.activityName === 'DictionaryEditor'
                        && self.activity.viewName)
                    {
                        return self.activity.viewName;
                    }

                    else if (self.activityName === 'DictionaryEditor'
                        && self.activity.etlName) 
                    {
                        etl = self.activity.etls[self.activity.etlName];
                    }
                    if (etl && etl.Load && etl.Enabled && !etl.Hidden)
                    {
                        return self.activity.etlName;
                    }

                    else if (self.activityName === 'Dictionary'
                        && self.activity.etlName)
                    {
                        return self.activity.etlName;
                    }

                    else if (self.lasts && self.lasts.DictionaryEditor
                        && self.lasts.DictionaryEditor.viewName)
                    {
                        return self.lasts.DictionaryEditor.viewName;
                    }

                    else
                    {
                        return undefined;
                    }
                };

                var getSchemaName = function ()
                {
                    return self.resolveProperty(pageDesc, 'schemaName');
                };

                var getViewIsInReporting = function ()
                {
                    return self.resolveProperty(pageDesc, 'isInReporting');
                };

                var getPackageName = function ()
                {
                    return self.resolveProperty(pageDesc, 'packageName');
                };

                var getLoadRandomSamplePackage = function ()
                {
                    return self.resolveProperty(pageDesc, 'loadRandomSamplePackage');
                };

                var getProcEtlName = function ()
                {
                    return self.resolveProperty(pageDesc, 'procEtlName');
                };

                // Determines the page name
                pageDesc.pageName = this.resolveProperty(pageDesc, 'pageName') || 'Etl';
                pageDesc.groupName = 'DictionaryEditor';

                switch (pageDesc.pageName)
                {
                    case 'Index':
                        pageDesc.url = 'etls';
                        break;

                    case 'ViewIndex':
                        pageDesc.url = 'viewEditor';
                        break;

                    case 'Etl':
                    case 'None':
                        pageDesc.etlName = getEtlName() || 'none';
                        pageDesc.url = 'etls/' + pageDesc.etlName;
                        break;

                    case 'ViewEditor':
                    case 'ViewEditorNone':
                        pageDesc.schemaName = getSchemaName() || 'FilteredAccess';
                        pageDesc.viewName = getViewName() || 'none';
                        pageDesc.isInReporting = getViewIsInReporting() || 'true';
                        pageDesc.url = 'viewEditor/' + pageDesc.schemaName + '/' + pageDesc.viewName + '/' + pageDesc.isInReporting;
                        break;

                    case 'ViewQuery':
                        pageDesc.schemaName = getSchemaName() || 'FilteredAccess';
                        pageDesc.viewName = getViewName() || 'none';
                        pageDesc.isInReporting = getViewIsInReporting() || 'true';
                        pageDesc.url = 'viewEditor/' + pageDesc.schemaName + '/' + pageDesc.viewName + '/' + pageDesc.isInReporting + '/ViewQuery';
                        break;

                    case 'SchemaEditor':
                        pageDesc.schemaName = getSchemaName() || 'none';
                        pageDesc.isInReporting = getViewIsInReporting() || 'true';
                        pageDesc.url = 'schemaEditor/' + pageDesc.schemaName + '/' + pageDesc.isInReporting;
                        break;

                    case 'ViewOrgFilterScript':
                        pageDesc.etlName = getEtlName();
                        pageDesc.url = 'viewEditor/' + pageDesc.etlName + '/ViewOrgFilterScript';
                        break;

                    case 'EtlDesign':
                        pageDesc.etlName = getEtlName();
                        pageDesc.url = 'etls/' + pageDesc.etlName + '/Design';
                        break;

                    case 'Sources':
                        pageDesc.etlName = getEtlName();
                        pageDesc.url = 'etls/' + pageDesc.etlName + '/Sources';
                        break;

                    case 'MatchingRules':
                        pageDesc.etlName = getEtlName();
                        pageDesc.url = 'etls/' + pageDesc.etlName + '/MatchingRules';
                        break;

                    case 'Package':
                        pageDesc.packageName = getPackageName();
                        pageDesc.loadRandomSamplePackage = getLoadRandomSamplePackage();
                        pageDesc.url = 'packages/' + pageDesc.packageName + '/Item/' + pageDesc.loadRandomSamplePackage;
                        break;

                    case 'PackageQueries':
                        pageDesc.packageName = getPackageName();
                        pageDesc.url = 'packages/' + pageDesc.packageName + '/Queries';
                        break;

                    case 'PackageLineage':
                        pageDesc.packageName = getPackageName();
                        pageDesc.url = 'packages/' + pageDesc.packageName + '/Lineage';
                        break;

                    case 'PackageTemplate':
                        pageDesc.templateName = this.resolveProperty(pageDesc, 'templateName');
                        pageDesc.url = 'packages/' + pageDesc.templateName + '/TemplateItem';
                        break;

                    case 'TemplateLineage':
                        pageDesc.templateName = this.resolveProperty(pageDesc, 'templateName');
                        pageDesc.url = 'packages/' + pageDesc.templateName + '/TemplateLineage';
                        break;

                    case 'ProcedureEtl':
                        pageDesc.procEtlName = getProcEtlName();
                        pageDesc.url = 'procedureetls/' + pageDesc.procEtlName;
                        break;
                    case 'ProcedureEtlLineage':
                        pageDesc.procEtlName = getProcEtlName();
                        pageDesc.url = 'procedureetls/' + pageDesc.procEtlName + '/Lineage';
                        break;
                }
            },

            Executions: function (pageDesc)
            {
                pageDesc.executionId = this.resolveProperty(pageDesc, 'executionId');
                pageDesc.groupName = 'Executions';
                pageDesc.url = 'execs';
                if (pageDesc.executionId)
                {
                    pageDesc.url += '/' + pageDesc.executionId;
                }
            },

            KitApps: function (pageDesc)
            {
                pageDesc.thirdPartyAppKey = this.resolveProperty(pageDesc, 'thirdPartyAppKey');
                pageDesc.action = this.resolveProperty(pageDesc, 'action');
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'kit-apps';
                if (pageDesc.thirdPartyAppKey && pageDesc.action === 'ActivateThirdPartyApp')
                {
                    pageDesc.url += '/' + pageDesc.action + '/' + pageDesc.thirdPartyAppKey;
                }
            },

            ResourceGovernor: function (pageDesc)
            {
                pageDesc.groupName = 'ResourceGovernor';
                pageDesc.url = 'resource-governor';
            },

            ErrorLog: function (pageDesc)
            {
                pageDesc.groupName = 'Executions';
                pageDesc.url = 'error-log';
            },

            StatusReport: function (pageDesc)
            {
                pageDesc.groupName = 'Executions';
                pageDesc.url = 'status-report';
            },

            WorkQueue: function (pageDesc)
            {
                pageDesc.issueId = this.resolveProperty(pageDesc, 'issueId');
                pageDesc.groupName = 'WorkQueue';
                pageDesc.url = 'issues';
                if (pageDesc.issueId)
                {
                    pageDesc.url += '/' + pageDesc.issueId;
                }
            },

            RecordAttributes: function (pageDesc)
            {
                pageDesc.attrId = this.resolveProperty(pageDesc, 'attrId');
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'record-attributes';
                if (pageDesc.attrId)
                {
                    pageDesc.url += '/' + pageDesc.attrId;
                }
            },

            DmcConfigurations: function (pageDesc)
            {
                pageDesc.etlName = this.resolveProperty(pageDesc, 'etlName');
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'config/dmc-configurations';
                if (pageDesc.etlName)
                {
                    pageDesc.url += '/' + pageDesc.etlName;
                }
            },

            HmmMappings: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'hmm-mappings';
            },

            Users: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'users';
            },

            EmailNotifications: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'config/emailNotifications';
            },

            Reports: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.reportName = this.resolveProperty(pageDesc, 'reportName');
                pageDesc.url = 'reports';
                if (pageDesc.reportName)
                {
                    pageDesc.url += '/' + pageDesc.reportName;
                }
            },

            SystemSettings: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'system-settings';
            },

            Sources: function (pageDesc)
            {
                pageDesc.groupName = 'DictionaryEditor';
                pageDesc.url = 'sources';
                pageDesc.templateName = this.resolveProperty(pageDesc, 'templateName');
                pageDesc.sourceId = this.resolveProperty(pageDesc, 'sourceId');
                pageDesc.sourceName = this.resolveProperty(pageDesc, 'sourceName');
                pageDesc.pageName = this.resolveProperty(pageDesc, 'pageName');
                if (pageDesc.pageName === 'TemplateInstance')
                {
                    if (pageDesc.sourceName)
                    {
                        pageDesc.url += ('/TemplateInstanceItem/' + pageDesc.sourceId + '/' + pageDesc.sourceName);
                    }
                    else
                    {
                        pageDesc.url += ('/TemplateInstanceItem/' + pageDesc.sourceId);
                    }
                }
                else if (pageDesc.pageName === 'None')
                {
                    pageDesc.url += ('/Sources');
                }
                else if (pageDesc.pageName === 'Template' && pageDesc.templateName)
                {
                    pageDesc.url += ('/TemplateItem/' + pageDesc.templateName);
                }
                else if (pageDesc.pageName === 'Sources' && pageDesc.sourceName != null)
                {
                    pageDesc.url += ('/Sources/-1/' + pageDesc.sourceName);
                }
                else if (pageDesc.pageName === 'Sources' && pageDesc.sourceId != null)
                {
                    pageDesc.url += ('/Sources/' + pageDesc.sourceId);
                }
            },

            Applications: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'applications';
            },

            //Research Data Network Stuff
            MappingIndex: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.table = this.resolveProperty(pageDesc, 'table');//this.activity.getTable();
                pageDesc.column = this.resolveProperty(pageDesc, 'column');
                //check if values are defined
                if (pageDesc.table === 'undefined' || pageDesc.table === null)
                {
                    pageDesc.url = 'Rdn/Mapping';
                }
                else if (pageDesc.column === 'undefined' || pageDesc.column === null)
                {
                    pageDesc.url = Utils.formatEncoded.call('Rdn/Mapping?tableName={0}', pageDesc.table);
                }
                else
                {
                    pageDesc.url = Utils.formatEncoded.call('Rdn/Mapping?tableName={0}&columnName={1}', pageDesc.table, pageDesc.column);
                }

            },

            StandardsIndex: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'Rdn/Standards';
            },

            Home: function (pageDesc)
            {
                pageDesc.groupName = '';
                pageDesc.url = '';
            },

            ViewActiveServiceCaches: function (pageDesc)
            {
                pageDesc.groupName = 'Configuration';
                pageDesc.url = 'config/ViewActiveServiceCaches';
            },

            InstallXML: function (pageDesc)
            {
                pageDesc.groupName = 'Tools';
                pageDesc.url = 'tools/InstallXML';
            },

            BulkScriptGeneration: function (pageDesc)
            {
                pageDesc.groupName = 'Tools';
                pageDesc.url = 'tools/BulkScriptGeneration';
            }
        };


        /**
         * Console.request implements the server-client communications used by the 
         * data warehouse console. Console.request extends jQuery's $.ajax to support 
         * opportunistic locking, signaling caching, and transport of server generated 
         * exceptions. 
         * 
         * Console.request does not handle errors. Instead, Console.request mollifies 
         * errors into a standard format. The errors are then displayed visually by UI 
         * nodes and sections using dialog boxes and notification boxes, respectively. 
         *
         * Code using the framework should not invoke Console.request directly. 
         * Instead, requests should be made within the context of a UI node via 
         * the UINode.request or UINode.requestHtml methods. 
         * 
         * @param {Object} options - The arguments of the request. The parameters 
         *   of these arguments are the same as the parameters to jQuery's $.ajax, 
         *   except this method recognizes a few additional parameters. The 
         *   additional parameters are listed below. 
         * 
         * @returns {!Promise} A promise that is resolved when the request is 
         *   successfully completes, and rejected when the request fails. 
         */
        Console.request = function (options)
        {
            var defaults =
            {
                /**
                 * The URL where request is sent
                 * @type {string}
                 */
                url: window.location.href,

                /**
                 * The HTTP method 
                 * @type {string}
                 */
                type: 'GET',

                /**
                 * The content to serialize into the request body. 
                 * @type {*}
                 */
                data: {},

                /**
                 * The MIME type of the request body. The special value 'auto' tells 
                 * Console.request to automatically determine the content type in the 
                 * following way: If data is an string, the content type is
                 * 
                 *   application/x-www-form-urlencoded; charset=UTF-8
                 * 
                 * . If the data is an object and the request method is POST, PUT, or 
                 * DELETE, then the data is serialized into JSON using the content type
                 * 
                 *   application/json; charset=utf-8
                 * 
                 * . Otherwise, the content type is 
                 * 
                 * application/x-www-form-urlencoded; charset=UTF-8
                 * 
                 * .
                 * 
                 * @type {string}
                 */
                contentType: 'auto',

                /**
                 * Custom HTTP request headers
                 * @type {Object={}}
                 */
                headers: {},

                /**
                 * The revision tracking interface used for opportunistic locking and 
                 * HTTP caching. If this is not specified, opportunistic locking is 
                 * disabled. 
                 * @type {?RevTrack}
                 */
                revTrack: { rev: $.noop, setHeadRev: $.noop, updateRev: $.noop },

                // Whether the URL is passed to the request already encoded
                urlEncoded: false,

                resize: true
            };
            var settings = $.extend(true /* deep */, {}, defaults, options);
            if (!settings.urlEncoded)
            {
                settings.url = encodeURI(settings.url);
            }

            var app = Console && Console.instance;

            // Perform request synchronously if the page is unloading and on Firefox
            if (app && app.isUnloading)
            {
                settings.async = false;
            }

            // Save a reference to jqxhr so the caller can abort the request. 
            var promise = {
                jqxhr: null
            };
            var dfd = $.Deferred();
            dfd.promise(promise);

            // If specified in the options, automatically determine the content type 
            // based on the type of the data argument
            if (settings.contentType === 'auto')
            {
                if (typeof settings.data === 'string')
                {
                    settings.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
                }
                else if (typeof settings.data === 'object' && /POST|PUT|DELETE/.test(settings.type))
                {
                    settings.contentType = 'application/json; charset=utf-8';
                    settings.data = JSON.stringify(settings.data);
                }
            }

            // Populate the If-No-Match header for opportunistic locking
            if (/GET|HEAD/.test(settings.type))
            {
                settings.headers["If-None-Match"] = settings.revTrack.rev();
            }

            // Populate the If-Match header for caching
            else // POST, PUT, or DELETE
            {
                settings.headers["If-Match"] = settings.revTrack.rev();
            }

            // Perform the request
            promise.jqxhr = $.ajax(settings)
                .done(function (response, textStatus, jqxhr)
                {
                    // Mark newly seen revision
                    if (textStatus === 'success')
                    {
                        settings.revTrack.setHeadRev(
                            jqxhr.getResponseHeader("Etag")
                            || response.rev
                            || undefined);

                        if (settings.type === 'GET')
                        {
                            settings.revTrack.updateRev();
                        }
                    }

                    dfd.resolveWith(this, [response, textStatus, jqxhr]);
                })
                .fail(function (jqxhr, textStatus, errorThrown)
                {
                    if (settings.ignoreErrors)
                    {
                        return;
                    }

                    var errorType;
                    var response;

                    // If error response is JSON, parse it
                    if (/application\/json/.test(jqxhr.getResponseHeader('content-type')))
                    {
                        try
                        {
                            response = $.parseJSON(jqxhr.responseText);
                        } catch (ex)
                        {
                            response = null;
                        }
                    }

                    // if response is HTML, parse it
                    else if (/text\/html/.test(jqxhr.getResponseHeader('content-type')))
                    {
                        try
                        {
                            var jsonp, section;

                            // Find the embedded JSON response, and an optional section 
                            // showing detailed information on the error
                            var elems = $(jqxhr.responseText);
                            for (var i = 0; i < elems.length; i++)
                            {
                                var elem = $(elems[i]);
                                if (elem.is('script.response'))
                                {
                                    jsonp = elem;
                                }

                                if (elem.is('section.rest-error-details'))
                                {
                                    section = elem;
                                }
                            }

                            if (!jsonp)
                            {
                                throw new Error('Can\'t locate embedded JSON response in HTML reponse');
                            }

                            // Parse the JSON response embedded in HTML
                            response = jsonp.callback();
                            if (typeof response !== 'object')
                            {
                                throw new Error('Embedded JSON response in HTML reponse is not an object');
                            }

                            // If the informational section is specified, convert it into a 
                            // dialog box by adding a close button and specifying a layout 
                            // policy. 
                            if (section)
                            {
                                response.dialogElem = section;
                                response.dialogElem.find('iframe.ysod').addClass('scroll');
                                if (response.dialogElem.find('.scroll').length)
                                {
                                    response.dialogElem.addClass('layout-by-scroll');
                                }

                                var footer = $(document.createElement('footer')).appendTo(response.dialogElem);
                                var actions = $(document.createElement('div')).addClass('dialog-actions')
                                    .appendTo(footer);
                                var close = $(document.createElement('button')).attr('data-action', 'close')
                                    .text('Close')
                                    .appendTo(actions);
                            }
                        } catch (ex)
                        {
                            // Ignore HTML scraping errors silently
                            response = null;
                        }
                    }

                    /* error types used by the console: 
                     * 
                     *     General, Database, Conflict, Exists, NotFound, ModelBind, 
                     *     Validation, Unauthorized, Locked, Service, MetadataIntegrity, Resource
                     *
                     */
                    if (textStatus === 'error' && response && typeof response.errorType === 'string')
                    {
                        errorType = response.errorType;
                    }

                    /* error types used by jQuery: 
                     * 
                     *     Error, Timeout, Abort, Parse
                     *
                     */
                    else if (textStatus !== null)
                    {
                        switch (textStatus)
                        {
                            case 'error': errorType = 'Http'; break;
                            case 'timeout': errorType = 'Timeout'; break;
                            case 'abort': errorType = 'Abort'; break;
                            case 'parsererror': errorType = 'Parse'; break;
                        }
                    }

                    /* 
                     * map all remaining errors to Unknown 
                     */
                    else
                    {
                        errorType = 'Unknown';
                    }
                    dfd.rejectWith(this, [response, errorType, jqxhr]);
                })
                .always(
                    function ()
                    {
                        if (settings.resize && app && app.nav && app.nav.resize)
                        {
                            app.nav.resize();
                        }
                    });

            return promise;
        };



        /**
         * An UINode represents an UI component which wraps around a single HTML 
         * element. AJAX requests are performed within UI nodes. 
         * 
         * Derived classes include Section, Dialog, List, and Activity. 
         * 
         * @constructor
         * @param {!jQuery} elem - The element around which this UI node wraps. 
         */
        Console.UINode = function (elem) 
        {
            this.elem = elem;
            this.initialized = true;
            this.destroyStack = [];
            this.promises = {};
            var accessKeyDomElems = $(elem).find('[access-key]');
            for (var i = 0; i < accessKeyDomElems.length; i++)
            {
                var accessKey = accessKeyDomElems[i].getAttribute('access-key');
                Utils.highlightAccessKey(accessKeyDomElems[i], accessKey);
            }
        };

        Console.UINode.prototype =
        {
            constructor: Console.UINode,

            /**
             * The element wrapped by this UI node. 
             * @type {!jQuery}
             */
            elem: undefined,

            /**
             * Callback functions to be called when this UI node is destroyed. 
             * @type {!Array.<function>}
             */
            destroyStack: undefined,

            /**
             * Named promises, such as Lock or Submit. 
             * @type {!Object.<string, Promise>}
             */
            promises: undefined,

            /**
             * Whether this UI node has been constructed and has not been destroyed. 
             * @type {boolean}
             */
            initialized: false,

            /**
             * Destroys this UI node. 
             */
            destroy: function () 
            {
                this.initialized = false;
                var cb;
                while (cb = this.destroyStack.pop())
                {
                    cb.call(this);
                }
            },

            /**
             * Adds the specified callbacks which will be run when this UI node is 
             * destroyed. 
             * @param {...function(this:Console.App)} arguments - Callbacks to push
             */
            pushDestroy: function ()
            {
                this.destroyStack.push.apply(this.destroyStack, arguments);
            },

            /**
             * Updates the internal layout of this UI node. This default implementation 
             * does nothing. Derived classes may override this behavior. 
             */
            updateLayout: function ()
            {
            },

            /**
             * Identifies a promise with a name so it can be easily accessed by other 
             * code. Once the named promise is resolved or rejected, its name is 
             * released so that the name can be reused to identify other promises. The 
             * named promises are stored in the promises object, keyed by their names. 
             * 
             * @param {string|undefined} name - The name with which to identify the promise. 
             * 
             * @param {string|undefined} policy - The name collision policy parameter controls 
             *   what to do if the name is already in use. The policy can be one of: 
             *   anonymous, replace, abort, suppress, and error. 
             * 
             *   anonymous Do not store the promise, even if it has a name. This policy
             *             is forced when the name parameter is undefined. 
             * 
             *   replace   Make the promise, and replace the existing promise with the 
             *             same name. This is the default policy if the name parameter 
             *             is defined. 
             * 
             *   abort     Make the promise, replace the existing promise with the same
             *             name, and if the existing promise is a AJAX request, abort 
             *             it. 
             * 
             *   suppress  If a promise with the same name exists, return that promise, 
             *             and do not make the specified promise. 
             * 
             *   error     If a promise with the same name exists, return a rejected 
             *             promise, and do not make specified promise. 
             * 
             * @param {function():Promise} makePromise - 
             *   Function which 'makes' and returns the promise. This is called if the 
             *   collision policy determines that that the promise should be made. 
             * 
             * @param {object=} errorContext - 
             *   Context used when rejecting the promise with an error. This option is 
             *   used when the error policy is active. 
             * 
             * @returns {!Promise} The promise as determined by the policy. 
             */
            namePromise: function (name, policy, makePromise, abortContext)
            {
                var self = this;
                var promise;

                // Anonymous requests must use the default policy
                if (!name) { policy = 'anonymous'; }

                // Named requests use the replace policy by default
                if (name) { policy = policy || 'replace'; }

                if (name in this.promises)
                {
                    promise = this.promises[name];

                    if (policy === 'abort')
                    {
                        if ('jqxhr' in promise)
                        {
                            promise.jqxhr.abort();
                        }
                    }

                    if (policy === 'suppress')
                    {
                        return promise;
                    }

                    if (policy === 'error')
                    {
                        return Deferred.failUnit(errorContext, 'Abort', null);
                    }
                }

                promise = makePromise()
                    .always(function ()
                    {
                        if (policy !== 'anonymous')
                        {
                            delete self.promises[name];
                        }
                    });

                if (policy !== 'anonymous')
                {
                    this.promises[name] = promise;
                }

                return promise;
            },

            /**
             * Requests a resource using this context for revision control, locking, 
             * error handling, and naming. 
             * 
             * @param {Object} options - The options of the request is a superset of 
             *   the options to Console.request (which itself is a superset of options 
             *   to jQuery's $.ajax). Options recognized by this method but not
             *   Console.request are:
             *     
             *   name {string=}
             *     The name of the request. @see Console.UINode.prototype.namePromise
             *   
             *   requestCollision {string=}
             *     What to do when two concurrent requests have the same name. 
             *     @see Console.UINode.prototype.namePromise
             *   
             *   errorBoxCollision {string=}
             *     What to do when two notification boxes resulting from failed 
             *     requests have the same name. 
             *     @see Console.Section.prototype.drawRestError
             * 
             * @returns {!Promise} A promise that is resolved when the request completes 
             *   successfully and rejected when the request fails. 
             * 
             * @see Console.request
             * 
             * @example
             * this.request({
                  url: app.baseUrl + 'lock', 
                  type: 'POST', 
                  data: { resource: this.resourceUrl, token: this.token }, 
                  name: 'lock', 
                  requestCollision: 'abort'
                })
             * 
             */
            request: function (options)
            {
                var self = this;

                options = options || {};
                options.revTrack = options.revTrack || (this.rev && this) || undefined;
                options.dataType = options.dataType || 'json';
                options.resize = options.hasOwnProperty('resize') ? options.resize : true;

                var getPromise = function () 
                {
                    var ajax = Console.request(options);
                    var promise = ajax
                        .then(undefined, function (response, errorType, jqxhr)
                        {
                            response = response || {};
                            response.name = this.name;
                            response.errorBoxCollision = this.errorBoxCollision;
                            Console.normalizeRestError(response);
                            return Deferred.failUnit.call(this, response, errorType, jqxhr);
                        })
                        .done(function (response, textStatus, jqxhr)
                        {
                            // Clear existing errors
                            if (self.initialized && this.name && this.errorBoxCollision !== 'add')
                            {
                                self.clearRestError.call(self, this.name);
                            }
                        })
                        .fail(function (response, errorType, jqxhr)
                        {
                            // Call error handler
                            if (self.initialized)
                            {
                                self.onRestError.call(self, response, errorType, jqxhr, this);
                            }
                        });
                    promise.jqxhr = ajax.jqxhr;
                    return promise;
                };

                return this.namePromise(
                    options.name, options.requestCollision,
                    getPromise, options);
            },

            /**
             * Requests a HTML document using this context for revision control. 
             * @param {Object} options - The options of the request. The parameters to 
             *   the request are the same as the parameters to 
             *   Console.UINode.prototype.request. @see Console.UINode.prototype.request
             * @returns {!Promise} A promise that is resolved when the request completes 
             *   successfully and rejected when the request fails. 
             */
            requestHtml: function (options)
            {
                var self = this;

                options = options || {};
                options.revTrack = options.revTrack || (this.rev && this) || undefined;
                options.dataType = options.dataType || 'html';

                var getPromise = function ()
                {
                    var ajax = Console.request(options);
                    var promise = ajax
                        .then(function (response, textStatus, jqxhr)
                        {
                            if (textStatus === 'success')
                            {
                                // Parse the response text as HTML
                                var elem;
                                try
                                {
                                    elem = $(response);
                                } catch (ex)
                                {
                                    return Deferred.failUnit.call(this, response, 'parsererror', jqxhr);
                                }

                                // The data-rev attribute in the root element specifies the most 
                                // recent revision number
                                if (this.revTrack && elem.attr('data-rev') !== undefined)
                                {
                                    this.revTrack.setHeadRev(elem.attr('data-rev'));
                                }

                                return Deferred.unit.call(this, elem, textStatus, jqxhr);
                            }
                            else  // notmodified
                            {
                                return Deferred.unit.call(this, response, textStatus, jqxhr);
                            }
                        })
                        .then(undefined, function (response, errorType, jqxhr)
                        {
                            response = response || {};
                            response.name = this.name;
                            response.errorBoxCollision = this.errorBoxCollision;
                            Console.normalizeRestError(response);
                            return Deferred.failUnit.call(this, response, errorType, jqxhr);
                        })
                        .done(function (elem, textStatus, jqxhr)
                        {
                            // Clear existing errors
                            if (self.initialized && this.name && this.errorBoxCollision !== 'add')
                            {
                                self.clearRestError.call(self, this.name);
                            }
                        })
                        .fail(function (response, errorType, jqxhr)
                        {
                            // Call error handler
                            if (self.initialized)
                            {
                                self.onRestError.call(self, response, errorType, jqxhr, this);
                            }
                        });

                    promise.jqxhr = ajax.jqxhr;
                    return promise;
                };

                return this.namePromise(
                    options.name, options.requestCollision,
                    getPromise, options);
            },

            /**
             * Requests the HTML of the page specified by the page descriptor. 
             * @param {!PageDesc} pageDesc - The page desciptor. This object is mutated 
             *   by this method. 
             * @param {Object=} options - Additional options passed to requestHtml. 
             * @returns {!Promise} A promise that is resolved when the request completes 
             *   successfully and rejected when the request fails. 
             */
            requestPage: function (pageDesc, options)
            {
                return this.requestHtml(
                    $.extend({
                        url: Console.instance.resolve(pageDesc),
                        data: { articleonly: true },
                        name: 'page'
                    }, options))
                    .then(function (elem)
                    {
                        var page, props;
                        elem.each(function ()
                        {
                            var $this = $(this);
                            if ($this.hasClass('page'))
                            {
                                page = $this;
                            }
                            if ($this.is('script[data-jsonp]'))
                            {
                                props = $this.callback() || {};
                            }
                        });

                        return Deferred.unit.call(this, page, props);
                    });
            },

            /**
             * Called when a request from this context encountered an error. This 
             * implementation pipes errors of all types except Abort to the 
             * drawRestError method. Derived classes may override this behavior. 
             * 
             * @param {Object} response - The error response object, or null if it 
             *   failed to parse. 
             * @param {string} errorType - One of the twenty error types. 
             * @param {jQueryXhr} - The jQuery wrapped XHR object. 
             * @param {Object} - The settings the request was initiated with. 
             */
            onRestError: function (response, errorType, jqxhr, settings)
            {
                switch (errorType)
                {
                    case 'Abort':
                        break;

                    case 'ModelBind':
                    case 'Unauthorized':
                    case 'NotFound':
                    case 'Conflict':
                    case 'Exists':
                    case 'Validation':
                    case 'General':
                    case 'Database':
                    case 'Service':
                    case 'Http':
                    case 'Timeout':
                    case 'Parse':
                    case 'Mapping':
                    case 'MetadataIntegrity':
                    case 'Resource':
                    case 'Unknown':
                    case 'Locked':
                    case 'QuietWindow':
                        this.drawRestError(response);
                        break;
                }
                $('html, body').animate({ scrollTop: 0 }, 'fast');
            },

            /**
             * Clears the error notification of an named request promise. This default 
             * implementation does nothing. Derived classes will override this 
             * behavior. 
             * @param {!Object} name - The name of the error to clear. 
             */
            clearRestError: function (name)
            {
            },

            /**
             * Displays a REST error. This implementation shows details of REST error 
             * in a modal dialog box. Derived classes may override this behavior. 
             * @param {!Object} error - The error response object, or null if it 
             *   failed to parse. This method may mutate this argument. 
             */
            drawRestError: function (error)
            {
                Console.normalizeRestError(error);

                var dialog;
                if (error.dialogElem)
                {
                    // If the error returned by the server specifies HTML for the dialog 
                    // box, use that instead. 
                    dialog = new Console.Dialog(error.dialogElem);
                }
                else
                {
                    // Otherwise create a message box with a title and message. 
                    dialog = Console.createMessageDialog(error.title, error.message);
                }

                dialog.open();
                dialog.promise()
                    .done(dialog.destroy.bind(dialog));
            },

            /*
             * Replace link tags with HTML links and return MvcHtmlString
             */
            textToWithLink: function (textLink)
            {
                function replaceWithLink(match)
                {
                    var app = Console.instance;

                    var regex = /&quot;(.*?)&quot;/g;
                    var matches, output = [];
                    while (matches = regex.exec(match))
                    {
                        output.push(matches[1]);
                    }

                    return '<a href="' + output[0] + '" target="_blank">' + output[1] + '</a>';
                }

                var linkPattern = /&lt;&lt;Link=&quot;((?!&quot;).)*&quot;, Text=&quot;((?!&quot;).)*&quot;&gt;&gt;/g;
                var text = Utils.htmlEncode(textLink);
                text = text.replace(linkPattern, replaceWithLink);

                var res = '';
                var lastChar;
                for (var i = 0, len = text.length; i < len; i++)
                {
                    lastChar = res[res.length - 1];
                    if (i > 0 && !res.match(/\s$/) && text.substring(i, i + 2) === '<a')
                    {
                        res += ' ' + text[i];
                    }
                    else if (i < len - 1 && !text.substring(i + 1, len).match(/^\s/) && text.substring(i - 1, i + 1) === 'a>')
                    {
                        res += text[i] + ' ';
                    }
                    else
                    {
                        res += text[i];
                    }
                }
                return res;
            }
        };


        /**
         * Normalizes a structure representing a REST error. 
         * @param {!Object} - The REST error to normalize. The object is mutated by 
         *   this operation. 
         */
        Console.normalizeRestError = function (error)
        {
            // Defaults
            error.errorType = error.errorType || 'Unknown';
            var defaults = Console.restErrorDefaults[error.errorType] || {};
            error.title = error.title || defaults.title || '';
            error.message = error.message || defaults.message || '';
            error.encode = error.encode || false;
            if (error.encode)
            {
                error.message = Utils.htmlEncode(error.message);
                error.encode = false;
            }

            // Anonymous requests use the add policy for error box collisions
            if (!error.name)
            {
                error.errorBoxCollision = 'add';
            }

            // Named requests use the replace policy for error box collisions by default
            if (error.name)
            {
                error.errorBoxCollision = error.errorBoxCollision || 'replace';
            }

            // If the error specifies a custom notification box, parse its html into a 
            // jQuery object. 
            if (error.box)
            {
                try 
                {
                    error.boxElem = $(error.box);
                    if (error.boxElem.length === 0)
                    {
                        delete error.boxElem;
                    }
                } catch (ex)
                {
                    delete error.boxElem;
                } finally
                {
                    delete error.box;
                }
            }

            // If the error specifies a custom dialog box, parse its html into a jQuery
            // object. 
            if (error.dialog)
            {
                try 
                {
                    error.dialogElem = $(error.dialog);
                    if (error.dialogElem.length === 0)
                    {
                        delete error.dialogElem;
                    }
                } catch (ex)
                {
                    delete error.dialogElem;
                } finally
                {
                    delete error.dialog;
                }
            }
        };

        /**
         * Default titles and error messages for REST errors. 
         * @type {Object.<string, {title:string, message:string}>}
         */
        Console.restErrorDefaults =
        {
            ModelBind:
            {
                title: 'Model binding error',
                message: 'Your request could not be interpreted by the server '
            },

            Unauthorized:
            {
                title: 'Unauthorized',
                message: 'You are not authorized to access the resource '
            },

            NotFound:
            {
                title: 'Resource not found',
                message: 'The resource you are attempting to access does not exist '
            },

            Conflict:
            {
                title: 'Update conflict',
                message: 'The resource you are attempting to update is out of date '
            },

            Exists:
            {
                title: 'Resource exists',
                message: 'The resource you are attempting to create already exists '
            },

            Validation:
            {
                title: 'Validation error',
                message: 'Your request is not semantically valid '
            },

            Locked:
            {
                title: 'Resource locked',
                message: 'The resource you are attempting to access is in use '
            },

            General:
            {
                title: 'Internal server error',
                message: 'The server could not process your request '
            },

            Database:
            {
                title: 'Database error',
                message: 'There was an error accessing the database '
            },

            Service:
            {
                title: 'Service unavailable',
                message: 'The service is unavailable '
            },

            Http:
            {
                title: 'HTTP request error',
                message: 'Your request could not be completed due to an error '
            },

            Timeout:
            {
                title: 'Timeout',
                message: 'Your request could not be satisfied within a time limit '
            },

            Abort:
            {
                title: 'Aborted',
                message: 'Your request was aborted '
            },

            Parse:
            {
                title: 'Parser error',
                message: 'The response to your request could not be parsed '
            },

            Mapping:
            {
                title: 'Mapping Error',
                message: 'Mapping Error '
            },

            Unknown:
            {
                title: 'Error',
                message: 'Your request could not be completed due to an error '
            },
            QuietWindow:
            {
                title: 'Quiet Window',
                message: 'Your request could not be completed due to an in progress Quiet Window '
            }
        };


        /**
         * Mixin which attaches an event handler to support actionable elements. 
         * Actionable elements are ones with the data-action attribute. Clicking on 
         * an actionable element invokes the method specified by the data-action 
         * attribute on the nearest UINode with such a method. 
         * 
         * @mixin
         * @this {!Console.UINode} The UI node to add support for actionable elements. 
         */
        Console.asActionable = (function ()
        {
            // Called when an action is triggered from a descendent of this element. 
            var onAction = function (actionName, event, target)
            {
                if (actionName in this)
                {
                    event.stopPropagation();
                    this[actionName].call(this, event, target);
                }
            };

            return function ()
            {
                var self = this;
                this.actions = this.actions || {};
                this.onAction = onAction;
                this.selectedText = '';

                this.elem.on('mousedown.console-asactionable', function (event)
                {
                    setTimeout(function ()
                    {
                        self.selectedText = window.getSelection().toString();
                    }, 0);
                });

                this.elem.on('click.console-asactionable', function (event)
                {
                    var target = $(event.target);
                    var actionTarget = target.closest('[data-action]');

                    // Ignore click events on disabled elements triggered by IE
                    if (actionTarget.prop('disabled'))
                    {
                        return;
                    }
                    // Ignore click events when something is being highlighted
                    var selectedText = window.getSelection().toString();
                    if (selectedText.length !== 0 && selectedText !== self.selectedText)
                    {
                        event.preventDefault();
                        self.selectedText = selectedText;
                        return;
                    }

                    var actionName = actionTarget.attr('data-action');
                    if (actionName !== undefined)
                    {
                        event.preventDefault();
                        self.onAction(actionName, event, actionTarget);
                    }
                });

                this.pushDestroy(function ()
                {
                    this.elem.off('click.console-asactionable');
                });
            };
        })();


        /**
         * Sections are UI elements with a header, body, and footer. Sections wrap 
         * around <section> elements. Sections support drawing notification boxes, 
         * handling actionable elements, and nesting of child sections. 
         * 
         * @constructor
         * @extends Console.UINode
         * @mixes Console.asActionable
         * @param {!jQuery} elem - The root element of the section. 
         */
        Console.Section = function (elem) 
        {
            var self = this;
            Console.UINode.call(this, elem);
            Console.asActionable.call(this);
            var header = this.getHeader();

            this.boxes = [];
            this.sections = [];

            this.openable = this.elem.hasClass('divot');
            if (this.openable)
            {
                header.attr('data-action', 'toggle');

                var marker = header.find('.divot-marker');
                if (!marker.length)
                {
                    marker = $(document.createElement('a'))
                        .attr('href', '#')  // Required for Space and Return to trigger click events
                        .addClass('divot-marker');

                    var $svg = Utils.Shapes.getDivot();
                    $svg.appendTo(marker);
                    marker.prependTo(header);
                }

                var open = this.isOpen();
                this.elem.toggleClass('open', open);
                this.elem.toggleClass('closed', !open);
            }

            // Call Console.NotifyBox for notification boxes already present in DOM
            var primordialBoxes = this.elem.children('.notify-box');
            primordialBoxes.detach();
            primordialBoxes.each(function ()
            {
                self.addBox($(this), function (boxElem, section)
                {
                    return new Console.NotifyBox(boxElem, section);
                });
            });
        };

        Console.Section.prototype =
        {
            /**
             * List of notification boxes in this section. 
             * @type Array.<Console.NotifyBox>
             */
            boxes: undefined,

            /**
             * List of child sections, excluding notification boxes
             * @type Array.<Console.Section>
             */
            sections: undefined,

            /**
             * Whether this section can be opened. 
             * @type boolean
             */
            openable: undefined,

            // Destroys this section. 
            destroy: function ()
            {
                while (this.boxes.length !== 0)
                {
                    var box = this.boxes.pop();
                    box.destroy();
                }
                this.sections.forEach(function (section) { section.destroy(); });
                Console.UINode.prototype.destroy.call(this);
            },

            /**
             * Expands this section. 
             */
            open: function ()
            {
                this.toggle(true);
            },

            /**
             * Collapses this section. 
             */
            close: function ()
            {
                this.toggle(false);
            },

            /**
             * Toggles whether this section is expanded. 
             * @param {boolean=} open - Whether this section is expanded. If 
             * unspecified, the section is inverted from its previous state. 
             */
            toggle: function (open)
            {
                if (open === undefined || open.target)
                {
                    open = !this.isOpen();
                }

                this.elem.toggleClass('open', open);
                this.elem.toggleClass('closed', !open);

                this.updateLayout();
            },

            /**
             * Whether the section is expanded. 
             * @returns {boolean}
             */
            isOpen: function ()
            {
                return this.elem.hasClass('open');
            },

            /**
             * Overrides UINode.drawRestError to pipe REST errors to notification 
             * boxes appearing in this section instead of to dialog boxes. 
             * 
             * This method uses the error.errorBoxCollision property to to suppress 
             * repetitive errors. The errorBoxCollision property can be: add, replace, 
             * and suppress. 
             * 
             *   add       Always draw the error box. This is the default for anonymous 
             *             requests. 
             * 
             *   replace   Always draw the error box. If a box exists with the same, 
             *             remove it. This is the default for named requests. 
             * 
             *   suppress  Draw the error box only if there does not exist a box with 
             *             the same name. 
             * 
             * @param {!Object} error - The REST error to draw. This structure is built 
             *   by the server-client communications framework. 
             * 
             * @returns {!Console.RestErrorNotifyBox} The REST error notification box
             */
            drawRestError: function (error)
            {
                Console.normalizeRestError(error);

                var ctor = function (boxElem, section)
                {
                    var canRemove = error.errorBoxCollision === 'add';
                    return new Console.RestErrorNotifyBox(boxElem, section, error, canRemove);
                };

                // Find and clean up existing boxes with the same name or has same message
                var box = this.findBox(error.name);
                if (box === undefined)
                {
                    box = this.findBoxByMessage(error.message);
                }
                var ix;
                if (error.name && box)
                {
                    if (error.errorBoxCollision === 'replace')
                    {
                        ix = box.remove();
                    }
                    else if (error.errorBoxCollision === 'suppress')
                    {
                        return box;
                    }
                }

                // If the REST error specifies a notification box, use it.
                if (error.boxElem)
                {
                    box = this.addBox(error.boxElem, ctor);

                    this.updateLayout();
                    return box;
                }

                // Otherwise construct a error box displaying the error message.
                else
                {
                    var content = $(document.createElement('p')).html(error.message);

                    // If the error has a dialog showing its details, add a button which 
                    // opens the dialog when clicked
                    if (error.dialogElem)
                    {
                        $(document.createElement('a'))
                            .text('Details')
                            .addClass('button')
                            .attr('data-action', 'openDialog')
                            .appendTo(content);
                        content.addClass('clearfix');
                    }

                    box = this.drawBox({
                        boxType: 'error',
                        title: error.title,
                        content: content,
                        ctor: ctor,
                        index: ix
                    });

                    this.updateLayout();
                    return box;
                }
            },

            /**
             * Clears a notification box with the same name as the specified request. 
             * This overrides Console.UINode .
             * @param {!Object} settings - The name of the error. 
             */
            clearRestError: function (name)
            {
                if (name)
                {
                    var box = this.findBox(name);
                    if (box !== undefined)
                    {
                        this.removeBox(box);
                        this.updateLayout();
                    }
                }
            },

            /**
             * Draws a notification box. 
             * @param {Object=} options - The arguments to the parameters of drawing the 
             *   notification box. See below for a description of the parameters. 
             * @returns {!Console.NotifyBox} - The notification box
             */
            drawBox: function (options)
            {
                var defaults =
                {
                    /**
                     * The type of notification box. 'info', 'warning', or 'error'.
                     * @type {string=info}
                     */
                    boxType: 'info',

                    /**
                     * The title of the notification box. 
                     * @type {string=}
                     */
                    title: '',

                    /**
                     * The content to show in the notification box. 
                     * @type {string|jQuery=}
                     */
                    content: '',

                    /**
                     * A function to construct the notification box UI node. 
                     * @type {function(jQuery, Console.Section}:Console.NotifyBox=}
                     */
                    ctor: function (boxElem, section)
                    {
                        return new Console.NotifyBox(boxElem, section, settings.canRemove);
                    },

                    /**
                     * Whether to draw a button on the top right which removes the box. 
                     * @type {boolean=true}
                     */
                    canRemove: true,

                    /**
                     * The positional index of the notification box. If unspecified, the 
                     * box appears immediately after the last notification box if there is 
                     * one, or immediately after the header if otherwise. 
                     * @type {number=}
                     */
                    index: undefined
                };
                var settings = $.extend({}, defaults, options);

                // Create box, header, and footer
                var boxElem = $(document.createElement('section')).addClass(settings.boxType + '-box');
                var header = $(document.createElement('header')).appendTo(boxElem);
                var footer = $(document.createElement('footer')).appendTo(boxElem);

                // Add title to header
                var title = $(document.createElement('h1'))
                    .text(settings.title)
                    .appendTo(header);

                // Add content to box
                if (typeof settings.content === 'string')
                {
                    $(document.createElement('p'))
                        .text(settings.content)
                        .insertAfter(header);
                }
                else if (settings.content.length)
                {
                    settings.content.insertAfter(header);
                }

                return this.addBox(boxElem, settings.ctor, settings.index);
            },

            /**
             * Adds a notification box. 
             * @param {!jQuery} boxElem - The notification box element to add. 
             * @param {function(jQuery, Console.Section}:Console.NotifyBox} ctor - A 
             *   function to construct the notification box. 
             * @param {number} - The index at which to place the notification box. If not 
             *   specified, the box will be after other boxes. 
             * @returns {!Console.NotifyBox} The constucted box. 
             */
            addBox: function (boxElem, ctor, index)
            {
                // Insert the new notification box immediately after existing boxes, or 
                // after the header if there are no existing boxes. 
                var $boxes;
                var $scroll = this.elem.find('.scroll:not(textarea)');
                var isScrollableForm = this.elem.hasClass('dialog') && this.elem.hasClass('layout-by-scroll') && ($scroll.length > 0);
                if (isScrollableForm)
                {
                    $boxes = $scroll.children('.notify-box');
                }
                else
                {
                    $boxes = this.elem.children('.notify-box');
                }
                var anchor = $boxes.eq(index !== undefined ? index : $boxes.length - 1);
                if (anchor.length === 0)
                {
                    if (!isScrollableForm)
                    {
                        anchor = this.getHeader();
                    }
                    else
                    {
                        anchor = $(document.createElement('span'));
                        anchor.addClass('hidden');
                        $scroll.first().prepend(anchor);
                    }
                }
                boxElem.insertAfter(anchor);

                var box = ctor(boxElem, this);
                this.boxes.push(box);

                return box;
            },

            /**
             * Removes a notification box. 
             * @param {Console.NotifyBox} box - The box to remove. 
             * @returns {Console.NotifyBox} The removed box. 
             */
            removeBox: function (box)
            {
                for (var i = 0; i < this.boxes.length; i += 1)
                {
                    if (this.boxes[i] === box)
                        break;
                }

                if (i !== this.boxes.length)
                {
                    box.destroy();
                    box.elem.remove();
                    this.boxes.splice(i, 1);

                    return i;
                }
                else
                {
                    return undefined;
                }
            },

            /**
             * Returns the first box with the specified name. 
             * @param {string} name - The name of the box
             * @returns {!Console.NotifyBox} The box, or undefined if no boxes have the 
             *   name. 
             */
            findBox: function (name)
            {
                for (var i = 0; i < this.boxes.length; i += 1)
                {
                    var box = this.boxes[i];
                    if (box.name === name)
                        return box;
                }
                return undefined;
            },

            /**
             * Returns the first box with the specified message. 
             * @param {string} message - The message of the box
             * @returns {!Console.NotifyBox} The box, or undefined if no boxes have the 
             *   name. 
             */
            findBoxByMessage: function (message)
            {
                var $return;
                this.elem.find('.notify-box')
                    .each(
                        function ()
                        {
                            var $box = $(this);
                            $box.find('.clearfix').each(
                                function ()
                                {
                                    if ($(this).text() === message)
                                    {
                                        $return = $box;
                                        return false;
                                    }
                                });
                            if ($return)
                            {
                                return false;
                            }
                        });
                return $return;
            },

            /**
             * Returns the header of this section. 
             * @returns {!jQuery} The header
             */
            getHeader: function ()
            {
                return this.elem.children('header');
            },

            /**
             * Returns the footer of this section. 
             * @returns {!jQuery} The footer
             */
            getFooter: function ()
            {
                return this.elem.children('footer');
            },

            updateLayout: function ()
            {
                for (var i = 0; i < this.sections.length; i++)
                {
                    this.sections[i].updateLayout();
                }
            }
        };
        Utils.inherit(Console.Section, Console.UINode);


        /**
         * Base class for all notification boxes. 
         * @constructor
         * @extends Console.Section
         * @param {!jQuery} elem - The root element of the notification box
         * @param {!Section} section - The section to which this notification box belongs
         * @param {boolean=false} canRemove - Whether to draw a button at the top right 
         *   corner which removes this box
         */
        Console.NotifyBox = function (elem, section, canRemove)
        {
            Console.Section.call(this, elem);
            this.section = section;

            // Determine box type from CSS classes of the root element
            if (elem.hasClass('error-box'))
            {
                this.boxType = 'error';
            }
            else if (elem.hasClass('warning-box'))
            {
                this.boxType = 'warning';
            }
            else if (elem.hasClass('info-box'))
            {
                this.boxType = 'info';
            }
            else
            {
                this.boxType = 'error';
            }

            var header = this.getHeader();

            this.elem
                .addClass('notify-box')
                .addClass(this.boxType + '-box');

            // Create box type icon
            var icon = $(document.createElement('div'))
                .addClass('box-type-icon')
                .prependTo(header);

            // Create remove button if enabled
            if (canRemove)
            {
                var close = $(document.createElement('div'))
                    .addClass('notify-box-remove')
                    .attr('data-action', 'remove')
                    .prependTo(header);
            }

            if (this.elem.find('.button').length)
            {
                this.dialogElem = this.elem.next('.dialog');
                this.dialogElem.detach();
            }
        };

        Console.NotifyBox.prototype =
        {
            /**
             * The type of this notification box. error, warning, or info. 
             * @type {string}
             */
            boxType: undefined,

            /**
             * A dialog associated with this notification box. This dialog is opened 
             *   from openDialog. 
             * @type {!jQuery}
             */
            dialogElem: undefined,

            /**
             * The section containing this notification box. 
             * @type {Console.Section}
             */
            section: undefined,

            /**
             * Removes this notification box. 
             */
            remove: function ()
            {
                this.section.removeBox(this);
            },

            /**
             * Opens the dialog associated with this notification box. 
             * @returns {!Promise} A promise that is resolved when the dialog closes
             */
            openDialog: function ()
            {
                var dialog = new Console.Dialog(this.dialogElem);
                dialog.open();
                return dialog.promise()
                    .done(dialog.destroy.bind(dialog));
            },

            /**
             * Shows the details of this error. 
             */
            showDetails: function ()
            {
                this.openDialog();
            }
        };
        Utils.inherit(Console.NotifyBox, Console.Section);


        /**
         * Notification box showing a REST error. 
         * @constructor
         * @extends Console.NotifyBox
         * @param {!jQuery} elem - The root element of the notification box
         * @param {!Section} section - The section to which this notification box belongs
         * @param {!Object} error - The REST error built by the server-client communications framework
         * @param {boolean=false} canRemove - Whether to draw a button at the top right 
         */
        Console.RestErrorNotifyBox = function (elem, section, error, canRemove)
        {
            Console.NotifyBox.call(this, elem, section, canRemove);
            this.error = error;
            this.name = error.name;

            if (this.error.dialogElem)
            {
                this.dialogElem = this.error.dialogElem;
            }
        };
        Utils.inherit(Console.RestErrorNotifyBox, Console.NotifyBox);

        /**
         * Base class for modal dialogs. A modal dialog is a section that appears 
         * over other content and blocks user interaction to other content. This 
         * modal dialog implementation can be opened only once. Dialogs can support 
         * pessimistic locking if Console.holdsLock is mixed in. 
         * 
         * @constructor
         * @extends Console.Section
         * @param {jQuery} elem - The root element of the dialog. 
         */
        Console.Dialog = function (elem)
        {
            var self = this;
            Console.Section.call(this, elem);

            this.deferred = $.Deferred();

            var app = Console.instance;
            app.activity.dialogs.push(this);

            // Put dialog in parking layer
            this.layer = Console.instance.pushParkingLayer()
                .append(this.elem);

            // Add close button to top right
            $(document.createElement('div'))
                .addClass('dialog-close')
                .attr('data-action', 'close')
                .attr('tabindex', '-1')
                .append(Utils.Shapes.getX())
                .prependTo(this.getHeader());

            // Add sentinels to prevent tabbing off the dialog
            $(document.createElement('div'))
                .attr('tabindex', 0)
                .addClass('dialog-sentinel')
                .on('focus.console-dialog', this.focusLast.bind(this))
                .prependTo(this.elem);

            $(document.createElement('div'))
                .attr('tabindex', 0)
                .addClass('dialog-sentinel')
                .on('focus.console-dialog', this.focusFirst.bind(this))
                .appendTo(this.elem);

            // The layers stack prevents focusing elements in anterior layers. 
            // @see Console.Layers 
        };

        Console.Dialog.prototype =
        {
            /**
             * The deferred object which is resolved when the dialog closes. 
             * @type {!Deferred}
             */
            deferred: undefined,

            /**
             * Whether the dialog is open. 
             * @type {boolean}
             */
            _isOpen: false,

            /**
             * The layer containing the dialog. The layer is the parent element of the 
             * dialog element, and is responsible for making the dialog appear on the 
             * page. The layer is a content layer if the dialog is open, and a parking 
             * layer otherwise. 
             * @type {!jQuery}
             */
            layer: undefined,

            /**
             * The shade present behind this dialog. 
             * @type {jQuery}
             */
            shade: null,

            // Destroys the dialog. 
            destroy: function ()
            {
                var app = Console.instance;
                this.elem.find('.dialog-sentinel').remove();
                this.elem.find('.dialog-close').remove();
                this.elem.off('.console-dialog');
                app.activity.dialogs.splice(app.activity.dialogs.indexOf(this), 1);
                Console.instance.popParkingLayer(this.layer);
                Console.Section.prototype.destroy.call(this);
            },

            /**
             * Opens the dialog. Returns a promise that is resolved when the dialog 
             * finished opening. 
             * @returns {!Promise}
             */
            open: function () 
            {
                var self = this;
                var app = Console.instance;

                if (this._isOpen)
                {
                    throw new Error('Invalid state');
                }

                // Acquire shades
                this.shade = app.acquireShade();

                // Move dialog from parking layer to content layer
                var layer = app.pushContentLayer()
                    .addClass('center-outer');
                this.elem
                    .addClass('center dialog')
                    .appendTo(layer);
                app.popParkingLayer(this.layer);
                this.layer = layer;

                // Start lock if this dialog has locking
                if (this.lock) { this.lock(); }

                // Initialize iframes
                this.initIframes();

                this.updateLayout();

                var promise;
                if (this.lock)
                {
                    // If dialog has locking, wait for lock to be acquired before 
                    // resolving promise. 
                    promise = this.promises.lock
                        .then(function ()
                        {
                            return Deferred.unit.call(self);
                        }, function ()
                        {
                            return Deferred.unit.call(self);
                        });
                }
                else
                {
                    promise = Deferred.unit.call(this);
                }

                return promise.done(function ()
                {
                    this._isOpen = true;

                    // Focus the element with the autofocus attribute, if there are any. If 
                    // not, then focus the first focusable element. 
                    var autofocus = this.elem.find('[autofocus]');
                    if (autofocus.length)
                    {
                        app.setFocus(this.layer, autofocus[0]);
                    }
                    else
                    {
                        this.focusFirst();
                    }

                    this.updateLayout();
                });
            },

            /**
             * Closes this dialog with the default reason. 
             */
            close: function ()
            {
                this.closeWith('close');
            },

            /**
             * Closes this dialog, resolving the promise with the specified reason 
             * and arguments. 
             * @param {...*} arguments - Arguments used in resolving the promise. 
             */
            closeWith: function ()
            {
                var app = Console.instance;

                if (!this._isOpen)
                {
                    throw new Error('Invalid state');
                }

                // Stop locking if this dialog has locking
                if (this.unlock) { this.unlock(); }

                // Move dialog from content layer to parking layer
                var layer = app.pushParkingLayer();
                this.elem
                    .removeClass('center dialog')
                    .appendTo(layer);
                app.popContentLayer(this.layer);
                this.layer = layer;

                // Release the shades
                app.releaseShade(this.shade);
                this.shade = null;

                this._isOpen = false;
                this.deferred.resolveWith(this, arguments);

                if (app.nav && app.nav.resize)
                {
                    app.nav.resize();
                }
            },

            /**
             * Returns a promise that is resolved when this dialog closes. 
             * @returns {!Promise}
             */
            promise: function ()
            {
                return this.deferred.promise();
            },

            /**
             * Returns whether this dialog is open
             * @returns {boolean}
             */
            isOpen: function ()
            {
                return this._isOpen;
            },

            /**
             * Populate iframes. This step is performed every time the dialog is 
             * opened because it's not possible to move an iframe without destroying 
             * its content. 
             */
            initIframes: function ()
            {
                var self = this;
                this.elem.find('iframe[data-html]').each(function ()
                {
                    var frame = this;
                    var install = function ()
                    {
                        var doc = frame.contentWindow.document;
                        doc.open();
                        doc.write($(frame).attr('data-html'));
                        doc.close();

                        // On some browsers, load is triggered again after its content loads. 
                        $(frame).one('load', function ()
                        {
                            self.updateLayout();
                        });
                        self.updateLayout();
                    };

                    // Some browsers don't initialize the iframe immediately. We populate 
                    // the iframe when it is ready. 
                    if (this.readyState && this.readyState !== 'complete')
                    {
                        // It is too late to set onload on IE8. We use $.fn.one instead. 
                        $(this).one('load', install);
                    }
                    else
                    {
                        install();
                    }
                });
            },

            /**
             * Focuses the first element in this dialog that is focusable via 
             * navigation, not including the focus sentinels. This method does nothing 
             * if no such element exists. 
             */
            focusFirst: function ()
            {
                var app = Console.instance;
                var layer = this.elem.closest('.content-layer');
                var toFocus = this.elem.find(':navfocusable:not(.dialog-sentinel):first')[0];
                app.setFocus(layer, toFocus);
            },

            /**
             * Focuses the last element in this dialog that is focusable via navigation
             * not including the focus sentinels. This method does nothing if no such 
             * element exists. 
             */
            focusLast: function ()
            {
                var app = Console.instance;
                var layer = this.elem.closest('.content-layer');
                var toFocus = this.elem.find(':navfocusable:not(.dialog-sentinel):last')[0];
                app.setFocus(layer, toFocus);
            },

            // Called by Console.holdsLock. Disables the submit button if the dialog does 
            // not hold a lock to the resource. 
            updateLock: function ()
            {
                if (!this.elem.hasClass('disabled-form') && !this.elem.find('.disabled-form').length)
                {
                    this.elem.find('[data-action=submit]').enable('lock' in this && this.hasLock());
                }
            },

            /**
             * The minimum height of the dialog. 
             * @type {number}
             */
            minHeight: 240,

            /** 
             * The maximum ratio of the height of the dialog to the height of the window. 
             * @type {number}
             */
            maxHeightCoeff: 0.8,

            updateLayout: function ()
            {
                var app = Console.instance;

                /* 
                 * The layout-by-scroll layout policy is used for dialogs that have a 
                 * single scrollable block element. The layout-by-scroll code attempts to 
                 * maintain four invariants: 
                 * 
                 * 1. The height of the dialog is greater than or equal to the minimum 
                 *    height specified by the minHeight property. 
                 * 2. The height of the dialog is less than or equal to the specified 
                 *    maximum height specified by the maxHeightCoeff property. 
                 * 3. The scrollable element is as tall as the dialog and its contents 
                 *    allow. 
                 * 4. The dialog is tall enough so that the scrollable element does not 
                 *    need scrollbars. 
                 * 
                 * Depending on the contents of the dialog and the window size, it may 
                 * not be possible to satisfy all of these invariants. When this occurs, 
                 * the invariants at the top of the list are given higher priority. 
                 */
                if (this.elem.hasClass('layout-by-scroll'))
                {
                    var $overflow = this.elem.find('.scroll');

                    // Create a clone of the .scroll area and set the height to auto.
                    // Presumably we do this because we need to calculate what the scrollHeight of the
                    // element _would_ have been if we hadn't decided to manually manage the height ourselves.

                    // jQuerys documentation for .clone():
                    // "For performance reasons, the dynamic state of certain form elements (e.g., user data typed
                    // into textarea and user selections made to a select) is not copied to the cloned elements."
                    // Given the above, its unclear why this works for <textarea> dialogs (i.e. all the generated script forms)
                    var $overflowClone = $overflow.clone();
                    $overflowClone.css('height', 'auto');
                    $overflowClone.insertAfter($overflow);

                    var scrollHeight = $overflowClone[0].nodeName !== 'IFRAME'
                        ? $overflowClone[0].scrollHeight
                        : $overflowClone[0].contentDocument.body && $overflowClone[0].contentDocument.body.scrollHeight || 0;
                    $overflowClone.remove();

                    var footer = this.getFooter();
                    var footerBottom = footer.position().top + footer.outerHeight(true);

                    var overflowHeight = $overflow.height();
                    var clientHeight = $overflow[0].nodeName !== 'IFRAME'
                        ? $overflow[0].clientHeight
                        : $overflow[0].contentDocument.body && $overflow[0].contentDocument.body.clientHeight || 0;

                    /* Compute new heights */
                    var contentHeight = footerBottom + scrollHeight - overflowHeight
                        + $overflow.innerHeight() - clientHeight; // (innerHeight - clientHeight) should just be the height of the horizontal scroll bar

                    // Make sure dialogHeight is between [minHeight, maxHeight]
                    var dialogHeight = Math.max(
                        Math.min(
                            contentHeight,
                            this.maxHeightCoeff * $(window).height()
                        ),
                        this.minHeight
                    );

                    overflowHeight = overflowHeight + dialogHeight - footerBottom;
                    $overflow.prev('.list-header').css('padding-right',
                        overflowHeight < scrollHeight ? app.getScrollBarWidth() + 'px' : '0');

                    /* Apply new heights */
                    this.elem.height(dialogHeight);
                    $overflow.height(overflowHeight);
                }

                // If disabled-form class or attribute is found, disable entire form
                if (this.elem.hasClass('disabled-form') || this.elem.find('.disabled-form').length)
                {
                    var inputs = this.elem.find(':input, span, a').not('[data-action=close]');
                    for (var i = 0; i < inputs.length; i++)
                    {
                        inputs[i].disabled = true;
                        inputs[i].title = '';
                    }
                    $('.remove-item').remove();
                }
                Console.Section.prototype.updateLayout.call(this);
            }
        };
        Utils.inherit(Console.Dialog, Console.Section);

        /**
         * Mixin to enable locking on the specified resource. The target of this 
         * mixin must have a updateLock method which is invoked when the lock status 
         * changes. 
         * @mixin
         * @this {!Object} The resource which this mixin targets. The resource must 
         *   have an updateLock method, and is responsible for starting the lock 
         *   timer by invoking this.lock(). 
         * @param {string} URL of the resource to lock. The URL is relative to the 
         *   application. 
         */
        Console.holdsLock = function (resourceUrl)
        {
            var self = this;

            // The URL of the resource to lock
            this.resourceUrl = resourceUrl;

            // Whether a lock had been successfully acquired in the past
            this.hadLock = false;

            // When the current lock was acquired, or 0 if there is no current lock. 
            this.lastLock = 0;

            // Locks expires in 90 seconds. We attempt to refresh the lock every 45 
            // seconds. If we lose the lock, we attempt to reaquire it every 10 
            // seconds. 
            this.lockTimer = new Console.ServoTimer({
                onTick: function ()
                {
                    return self.requestLock()
                        .always(self.updateLock.bind(self));
                },
                period: 45.0
            });

            var fns =
            {
                /**
                 * Attempt to start locking on this dialog. 
                 */
                lock: function ()
                {
                    this.lockTimer.start();
                },

                /**
                 * Attemt to stop locking on this dialog. 
                 */
                unlock: function ()
                {
                    if (this.lockTimer.state() === 'running')
                    {
                        this.requestUnlock();
                        this.lockTimer.stop();
                    }
                },

                /**
                 * Performs a lock request. 
                 * @returns {!Promise} A promise that completes when the request 
                 *   completes. 
                 * @private
                 */
                requestLock: function ()
                {
                    var app = Console.instance;
                    return this.request({
                        url: app.baseUrl + 'lock',
                        type: 'POST',
                        data: { resource: this.resourceUrl, token: this.token },
                        name: 'lock',
                        requestCollision: 'replace'
                    })
                        .done(function (response)
                        {
                            self.token = response.token;
                            self.lastLock = self.lockTimer.last;
                            self.lockTimer.setPeriod(45.0);
                            self.hadLock = true;
                        })
                        .fail(function ()
                        {
                            self.lastLock = 0;
                            self.lockTimer.setPeriod(10.0);
                        });
                },

                /**
                 * Performs an unlock request. 
                 * @returns {!Promise} A promise that completes when the request 
                 *   completes. 
                 * @private
                 */
                requestUnlock: function ()
                {
                    var app = Console.instance;
                    return this.request({
                        url: app.baseUrl + 'unlock',
                        type: 'POST',
                        data: { resource: this.resourceUrl, token: this.token },
                        name: 'lock',
                        requestCollision: 'abort'
                    })
                        .done(function (response)
                        {
                            self.lastLock = 0;
                        });
                },

                /**
                 * Whether a lock on this resource is currently held. 
                 * @returns {boolean}
                 */
                hasLock: function ()
                {
                    return Date.now() < this.lastLock + 90.0 * 1000;
                }
            };

            $.extend(this, fns);
        };

        /**
         * The abstract base class for form dialogs. Form dialogs are dialogs with a 
         * <form> element. FormDialog adds facilities for submitting forms, client 
         * side validation, server side validation, and integration with 
         * jquery-validation. 
         * 
         * @extends Console.Dialog
         * @param {!jQuery} elem - The root element of the form dialog. 
         * @param {!Object={}} options - Options controlling behavior of form dialog. 
         *   The options are:
         * 
         *   fieldValidationMode {string=both}
         *     The field validation mode. Must be 'server', 'append-to-form', 
         *     'client', or 'both'. 
         * 
         *   formValidationMode {string=server}
         *     The form validation mode. Must be 'server', or 'client'. 
         * 
         *   lock {string|undefined}
         *     The application relative URL of the resource to lock, if specified. 
         * 
         * @param {!Object={}} validateOptions - The arguments to the jquery-validation 
         *   plugin. @see jquery-validation
         */
        Console.FormDialog = function (elem, options, validateOptions)
        {
            var self = this;
            Console.Dialog.call(this, elem);
            options = options || {};

            this.formValidationMode = options.formValidationMode || 'server';
            this.fieldValidationMode = options.fieldValidationMode || 'both';

            // Default options to jquery-validation
            var validateDefaults =
            {
                submitHandler: function () 
                {
                    self.postForm()
                        .always(function ()
                        {
                            self.updateLayout();
                        });
                },

                showErrors: function (errorMap, errorList)
                {
                    this.defaultShowErrors();
                    self.updateLayout();
                },

                removeLoadingWheel: function ()
                {
                    self.stopLoadingWheel();
                    self.finalizeLoadingWheel();
                },

                errorClass: 'validation-error',

                errorPlacement: this.errorPlacement.bind(this),

                onfocusout: function (elem, event)
                {
                    var $elem = $(elem);
                    if ($elem.hasClass('remote-error') || $elem.hasClass('validation-error'))
                    {
                        return;
                    }

                    if (this.checkable(elem))
                    {
                        return;
                    }
                    if (!(elem.name in this.submitted) && this.optional(elem))
                    {
                        return;
                    }
                    this.element(elem);
                },

                onclick: function (elem, event)
                {
                    var $elem = $(elem);
                    if ($elem.hasClass('remote-error'))
                    {
                        return;
                    }
                    // click on selects, radiobuttons and checkboxes
                    if (elem.name in this.submitted)
                    {
                        this.element(elem);
                    }
                    // or option elements, check parent select in that case
                    else if (elem.parentNode.name in this.submitted)
                    {
                        this.element(elem.parentNode);
                    }
                },

                onkeyup: function (element, event) 
                {
                    var $elem = $(element);
                    if ($elem.hasClass('remote-error') || $elem.hasClass('validation-error') && (event.keyCode === 13 || event.keyCode === 9))
                    {
                        return;
                    }
                    if (event.which === 9 && this.elementValue(element) === '')
                    {
                        return;
                    }
                    else if (element.name in this.submitted || element === this.lastElement)
                    {
                        this.element(element);
                    }
                }
            };

            if (typeof options.lock === 'string')
            {
                Console.holdsLock.call(this, options.lock);
            }

            // The <form> element
            this.form = this.elem.find('form');

            // Initialize jquery-validation on this form
            this.validator = this.form.validate($.extend({}, validateDefaults, validateOptions));

            this.loadingWheel = this.elem.find('.loading-wheel');
            this.wheelAnimator = $({ theta: 0 });
        };

        Console.FormDialog.prototype =
        {
            /**
             * The <form> element in this form dialog. 
             * @type {!jQuery}
             */
            form: undefined,

            /** 
             * The jquery-validation instance used by this form dialog. 
             * @type {!Validator}
             */
            validator: undefined,

            /**
             * Where form validation errors are sourced. Must be server or client. 
             * @type {string}
             */
            formValidationMode: undefined,

            /**
             * Where field validation errors are sourced. Must be both or client. 
             * @type {string}
             */
            fieldValidationMode: undefined,

            loadingWheel: undefined,
            wheelAnimator: undefined,
            buttonStateCache: undefined,

            /**
             * Whether the form dialog is currently showing remote validation errors. 
             * Used by onValidationError to signal to errorPlacement. 
             * @type {boolean}
             */
            showingRemoteErrors: false,

            // Destroys this form dialog. 
            destroy: function ()
            {
                if ('submitDfd' in this)
                {
                    this.submitDfd.jqxhr.abort();
                }

                Console.Dialog.prototype.destroy.call(this);
            },

            /**
             * Performs client side validation, and submit the form if no errors are 
             * found. This default implementation uses jquery-validation for client-
             * side validation. Derived classes may override this method to perform 
             * client-side validation external to jquery-validation. 
             */
            submit: function ()
            {
                // Use jquery-validation for client-side validation
                this.form.trigger('submit');
            },

            /**
             * Serializes this form to an serializable object or a string. This default 
             * implementation serializes the form to a string using $.fn.serialize. 
             * Derived classes may override this method. 
             * @returns {Object|string}
             */
            serializeForm: function ()
            {
                return this.form.serialize();
            },

            /**
             * Submits the form, and await either success or server validation errors. 
             * @returns {!Promise}
             */
            postForm: function ()
            {
                var self = this;

                // A hidden input named X-HTTP-Method-Override specifies the request method
                var methodOverride = this.form.find('input[name="X-HTTP-Method-Override"]');
                var method = methodOverride.length !== 0 ? methodOverride.attr('value') : this.form[0].method;
                methodOverride.detach().prependTo(this.form);
                method = method.toUpperCase();

                this.initializeLoadingWheel();
                this.startLoadingWheel();
                var textChangeHandle = setTimeout(
                    function ()
                    {
                        if (self.loadingWheel && self.loadingWheel.length)
                        {
                            self.loadingWheel.find('span.loading-indicator').text('Still working\u2026');
                        }
                    }, 5000);
                var start = Date.now();
                var end = start;

                return this.request({
                    url: this.form[0].action,
                    type: method,
                    data: this.serializeForm(),
                    name: 'submit',
                    requestCollision: 'suppress',
                    urlEncoded: true
                })
                    .always(function ()
                    {
                        delete self.submitDfd;
                        clearTimeout(textChangeHandle);
                        self.stopLoadingWheel();
                    })
                    .done(function (response, textStatus, jqxhr)
                    {
                        end = Date.now();
                        if ((end - start) > 5000)
                        {
                            var $wheel = self.loadingWheel.find('svg').has('g.svg-loading-wheel');
                            var $check = Utils.Shapes.getCheck();
                            $check.insertAfter($wheel);
                            $wheel.hide();
                            var $text = self.loadingWheel.find('span.loading-indicator');
                            $text.toggleClass('header-text', false);
                            $text.toggleClass('confirmation-text', true);
                            $text.text('Done!');
                            setTimeout(function ()
                            {
                                self.finalizeLoadingWheel();
                                self.closeWith('submit', response);
                            }, 1500);
                        }
                        else
                        {
                            self.finalizeLoadingWheel();
                            self.closeWith('submit', response);
                        }
                    })
                    .fail(
                        function ()
                        {
                            self.finalizeLoadingWheel();
                        });
            },

            // Overrides Console.UINode.prototype.onRestError by piping Validation 
            // errors to onValidationError. 
            onRestError: function (response, errorType, jqxhr, settings)
            {
                if (errorType === 'Validation')
                {
                    this.clearRestError(response.name);
                    this.onValidationError(response.messages);
                    this.deferred.notify('badattempt', response, errorType, jqxhr);
                }
                else
                {
                    Console.Dialog.prototype.onRestError.apply(this, arguments);
                }
            },

            // Called when an request from this context encounters a Validation REST 
            // error. 
            onValidationError: function (messages)
            {
                var self = this;

                for (var i = 0; i < messages.length; i++)
                {
                    messages[i].error = Utils.htmlEncode(messages[i].error);
                }
                // Creates a container for form level validation errors. 
                var formErrorsDiv = (function ()
                {
                    var div = self.form.find('.form-validation-errors');
                    if (div.length === 0)
                    {
                        div = $(document.createElement('div'))
                            .addClass('form-validation-errors')
                            .prependTo(self.form);
                    }

                    if (div.children('ul').length === 0)
                    {
                        $(document.createElement('ul')).appendTo(div);
                    }

                    return div;
                })();

                var ul = formErrorsDiv.find('ul').empty();

                if (this.formValidationMode === 'server')
                {
                    // Server performs form-level validation. Draw form-level errors above form.
                    messages.forEach(function (kv)
                    {
                        if (kv.key === '')
                        {
                            $(document.createElement('li')).html(kv.error).appendTo(ul);
                        }
                    });

                    ul.eq(':empty').remove();
                }

                if (this.fieldValidationMode === 'both')
                {
                    // Server performs field-level validation after client successfully performs field-level validation. 
                    this.validator.resetForm();
                    this.form.find('.validation-error').removeClass('validation-error');

                    var errors = {};
                    messages.forEach(function (kv)
                    {
                        if (kv.key !== '')
                        {
                            if (self.elem.find('[name="' + kv.key + '"]').length !== 0)
                            {
                                errors[kv.key] = kv.error;
                            }
                            else
                            {
                                var text = kv.key + ': ' + kv.error;
                                $(document.createElement('li')).html(text).appendTo(ul);
                            }
                        }
                    });

                    this.showingRemoteErrors = true;
                    this.validator.showErrors(errors);
                    for (var name in errors)
                    {
                        this.validator.submitted[name] = errors[name];
                    }
                    this.showingRemoteErrors = false;
                }
                //position the first validation error at top of scrollable section
                var firstError = this.form.find('.validation-error').first();
                var scroll = this.elem.find('.scroll');
                if (scroll.length && scroll.find('.validation-error').length)
                {
                    //compute the distance from the top of the scrollable element to the error
                    var currentElem = scroll.find('.validation-error').first();
                    var position, top = 0;
                    do
                    {
                        position = currentElem.position();
                        top += position !== undefined ? position.top : 0;
                        currentElem = currentElem.offsetParent();
                    }
                    while (!currentElem.hasClass('scroll') && currentElem[0] != currentElem.offsetParent()[0]);
                    scroll.scrollTop(top + scroll.scrollTop());
                }
                firstError.focus();
            },

            //sets a left-positioned custom tooltip differently if the tooltip is off screen
            setTooltipPosition: function (event)
            {
                var tooltips = this.elem.find('.tooltip');
                if (tooltips.length > 0)
                {
                    for (var i = 0; i < tooltips.length; i++)
                    {
                        var tooltip = $(tooltips[i]);
                        var rect = tooltips[i].getBoundingClientRect();
                        if (rect.left < 0 && !tooltip.hasClass('off-screen'))
                        {
                            tooltip.addClass('off-screen');
                        }
                        else if (tooltip.hasClass('off-screen'))
                        {
                            tooltip.removeClass('off-screen');
                        }
                    }
                }
            },

            /** 
             * @see jquery-validation
             */
            errorPlacement: function (error, elem)
            {
                elem.toggleClass('remote-error', this.showingRemoteErrors);
                var item;
                //If it's a data type validation, find the first field that's visible and append the error to it (so that it'll highlight in red)
                if (elem.hasClass("hiddenDataType"))
                {
                    var $errorField = elem.parent();
                    do
                    {
                        $errorField = $errorField.prev();
                    } while ($errorField.length && $errorField.is(':hidden'));
                    error.appendTo($errorField);
                    $errorField.children("select:visible").addClass("validation-error");
                }
                else if ((item = elem.closest('.left-label'))
                    && item.length)
                {
                    error.appendTo(item);
                }
                else if (
                    (item = elem.closest('.top-label'))
                    && item.length)
                {
                    error.appendTo(item.children('label, .label').first());
                }
                else if (
                    (item = elem.closest('.mixed-field'))
                    && item.length)
                {
                    error.insertAfter(item);
                }
                else
                {
                    error.insertAfter(elem);
                }
            },

            initializeLoadingWheel: function (makeLayer)
            {
                if (makeLayer === undefined)
                {
                    makeLayer = true;
                }

                var self = this;
                if (this.loadingWheel && this.loadingWheel.length)
                {
                    var $accept = this.elem.find('footer button[data-action="submit"]');
                    if ($accept && $accept.length)
                    {
                        $accept.focus();
                    }

                    if (!this.buttonStateCache)
                    {
                        this.buttonStateCache = {};
                    }
                    this.elem.find('footer button, footer a.button').each(
                        function ()
                        {
                            var $this = $(this);
                            var id = Utils.getElementUniqueId($this);
                            if (self.buttonStateCache[id] === undefined)
                            {
                                var isDisabled = $this.hasClass('hidden');
                                self.buttonStateCache[id] = isDisabled;
                                $this.toggleClass('hidden', true);
                            }
                        });

                    if (!this.loadingWheel.children('span.loading-indicator').length)
                    {
                        var $svg = this.loadingWheel.find('svg').has('g.svg-loading-wheel');
                        var $text = $(document.createElement('span'));
                        $text.text('Working\u2026');
                        $text.addClass('header-text');
                        $text.addClass('loading-indicator');
                        $text.insertAfter($svg);
                        $svg.show();
                    }

                    var $inputs = this.elem.find('input, textarea, select');
                    $inputs.on('focusin.loading-wheel, keydown.loading-wheel',
                        function (event)
                        {
                            event.preventDefault();
                            return false;
                        });

                    if (makeLayer)
                    {
                        var $layer = $(document.createElement('div'));
                        $layer.addClass('form-layer');
                        var headerHeight = this.elem.find('header').outerHeight() + parseInt(this.elem.find('header').css('margin-top')) + parseInt(this.elem.find('header').css('margin-bottom'));
                        var footerHeight = this.elem.find('footer').outerHeight() + parseInt(this.elem.find('footer').css('margin-top')) + parseInt(this.elem.find('footer').css('margin-bottom'));
                        var height = 'calc(100% - ' + (headerHeight + footerHeight).toString() + 'px)';
                        $layer.css('height', height);
                        $layer.css('top', headerHeight);
                        $layer.insertAfter(this.form);
                    }
                }
            },

            startLoadingWheel: function ()
            {
                var self = this;

                if (this.loadingWheel && this.loadingWheel.length)
                {
                    this.loadingWheel.toggleClass('hidden', false);
                    var to = { theta: 36000 };
                    var transformHead = 'rotate(';
                    var transformTail = ' 0 0)';
                    var $svg = this.loadingWheel.children('svg').has('g.svg-loading-wheel');
                    $svg.toggleClass('hidden', false);
                    var gTag = $svg.children('g.svg-loading-wheel')[0];

                    self.wheelAnimator.animate(to,
                        {
                            duration: 90000,
                            easing: 'linear',
                            step: function (now, fx)
                            {
                                now = +now;
                                var nowSnap = (now - (now % 30)) % 360;
                                var nowString = (+nowSnap).toString(10);
                                gTag.setAttribute('transform', transformHead + nowString + transformTail);
                            },
                            complete: function ()
                            {
                                $(gTag).removeAttr('transform');
                                self.wheelAnimator = $({ theta: 0 });
                                self.startLoadingWheel();
                            }
                        });
                }
            },

            stopLoadingWheel: function ()
            {
                var self = this;

                if (this.loadingWheel && this.loadingWheel.length)
                {
                    this.wheelAnimator.stop();
                }
            },

            finalizeLoadingWheel: function ()
            {
                var self = this;
                if (this.buttonStateCache)
                {
                    this.elem.find('footer button, footer a.button').each(
                        function ()
                        {
                            var $this = $(this);
                            var id = Utils.getElementUniqueId($this);
                            if (self.buttonStateCache[id] !== undefined)
                            {
                                $this.toggleClass('hidden', self.buttonStateCache[id] === true);
                            }
                            else
                            {
                                $this.removeClass('hidden');
                            }
                        });
                    delete this.buttonStateCache;
                }

                this.loadingWheel.toggleClass('hidden', true);
                var $check = this.loadingWheel.find('svg.svg-check');
                var $text = this.loadingWheel.find('span.loading-indicator');
                $text.remove();
                $check.remove();
                this.form.parent().find('.form-layer').remove();
                this.elem.find('input, textarea, select').off('.loading-wheel');
            },

            // Call when the user clicks a tab
            // Hides all data from other tabs, unhides data from this tab. Marks this tab as active.
            // tabDataId is the ID of the element that encapsulates all the stuff for that tab
            // event is the click event
            // parentForm is the form
            showDataForChosenTab: function (parentForm, tabDataId, event)
            {
                // Declare all variables
                var i, tabcontent, tablinks;

                // Get all elements with class="tabcontent" and hide them
                tabcontent = document.getElementsByClassName("tabcontent");
                for (i = 0; i < tabcontent.length; i++)
                {
                    tabcontent[i].style.display = "none";
                }

                // Get all elements with class="tablinks" and remove the class "active"
                tablinks = document.getElementsByClassName("tablinks");
                for (i = 0; i < tablinks.length; i++)
                {
                    tablinks[i].className = tablinks[i].className.replace(" active", "");
                }

                // Show the current tab, and add an "active" class to the button that opened the tab
                document.getElementById(tabDataId).style.display = "block";
                event.currentTarget.className += " active";
                event.currentTarget.focus();
                parentForm.updateLayout();
            },

            addInsertableTagsToTargetText: function (event, target)
            {
                // Build whole tag string
                var tagName = "<<" + target.closest('[data-tag-name]').attr('data-tag-name') + ">>";

                // Get the elem who's value we will update
                var targetValue = "#" + target.closest('[target-value]').attr('target-value');
                var targetValueElem = this.elem.find(targetValue);

                // Get where the cursor is
                var cursorStartPosition = targetValueElem.prop("selectionStart");
                var cursorEndPosition = targetValueElem.prop("selectionEnd");

                // Update the value of the elem to have the tag where the cursor is
                var beginningText = targetValueElem.val().substring(0, cursorStartPosition);
                var endingText = targetValueElem.val().substring(cursorEndPosition, targetValueElem.val().length);
                targetValueElem.val(beginningText + tagName + endingText);

                // Put the cursor at the end of the original position, accounting for what we just added/removed
                var newPosition = cursorEndPosition + tagName.length - (cursorEndPosition - cursorStartPosition);
                targetValueElem[0].setSelectionRange(newPosition, newPosition);
            },

            showOrHideInsertableTags: function (event, target)
            {
                var divot = target.closest('[data-tag-divot]');
                var parentDiv = divot.parent();
                var allButtons = parentDiv.children();

                if (divot.hasClass('open'))
                {
                    for (i = 0; i < allButtons.length; i++)
                    {
                        if ($(allButtons[i]).hasClass('data-tag-button-span'))
                        {
                            $(allButtons[i]).addClass('hidden');
                        }
                    }

                    divot.removeClass('open');
                }
                else
                {
                    for (i = 0; i < allButtons.length; i++)
                    {
                        if ($(allButtons[i]).hasClass('data-tag-button-span'))
                        {
                            $(allButtons[i]).removeClass('hidden');
                        }
                    }

                    divot.addClass('open');
                }
            }
        };
        Utils.inherit(Console.FormDialog, Console.Dialog);


        /**
         * Abstract utility class which loads a dialog whose HTML is built remotely. 
         * Concrete classes derived from this will specify the URL from which to load 
         * the HTML, the Console.Dialog class constructor, and an optional refresh 
         * method which runs after the dialog closes. 
         * @param {string} url - The application-relative URL from which to retrieve 
         *   the HTML of the form. 
         * @param {UINode=} context - The context from which to perform remote requests. 
         */
        Console.RemoteDialogLoader = function (url, context)
        {
            var app = Console.instance;

            this.url = url || '/';
            this.context = context || app.activity.page || app.activity;
        };

        Console.RemoteDialogLoader.prototype =
        {
            constructor: Console.RemoteDialogLoader,
            useShade: true,

            /**
             * The dialog loaded by this loader, or null if the dialog has not yet been 
             * loaded. 
             * @type {Console.Dialog}
             */
            dialog: null,

            /**
             * Retrieves the root element of the dialog. Derived classes may override 
             * this. 
             * @returns {!Promise} A promise that resolves when the dialog is retrieved. 
             */
            retrieveDialog: function ()
            {
                return this.context.requestHtml({
                    url: this.url,
                    name: 'loadDialog'
                });
            },

            /**
             * Constructs the dialog from HTML. Derived classes will override this 
             * method to return an instance of Console.Dialog . 
             * @abstract
             * @param {!jQuery} elem - the root element of the dialog. 
             * @returns {!Dialog}
             */
            createDialog: function (elem) { },

            /**
             * Method which runs after the dialog closes. The default implementation 
             * calls the refresh method on the request context, but only if the dialog 
             * closed because it was successfully submitted. Derived class may 
             * override this behavior. 
             * @param {!Console.Dialog} dialog - The dialog that closed
             * @param {string} closeReason - Why the dialog was closed
             * @param {!Array} response - The response from the form submission
             * @returns {!Promise} A promise that completes when the actions finish. 
             */
            postCloseActions: function (dialog, closeReason, response)
            {
                if (closeReason === 'submit')
                {
                    return this.refresh(response, dialog);
                }
                else
                {
                    return Deferred.unit();
                }
            },

            /**
             * Refreshes display elements after the form is submitted. This default 
             * implementation of defers to the refresh method the context if it exists. 
             * @param {!Array} response - The response from the form submission
             * @param {!Console.Dialog} dialog - The closed dialog
             * @returns {!Promise} A promise that completes when the refresh finishes. 
             */
            refresh: function (response, dialog)
            {
                if (typeof this.context.refresh === 'function')
                {
                    return this.context.refresh(response);
                }
                else
                {
                    return Deferred.unit();
                }
            },

            /**
             * Retrieves the dialog HTML, constructs the dialog, opens it, waits for it
             * to close, destroys the dialog, and refreshes the page. 
             * @returns {!Promise} A promise that completes when the steps are complete. 
             */
            load: function ()
            {
                var self = this;
                var app = Console.instance;

                // open shade
                var shade, loadingShade;
                if (this.useShade)
                {
                    shade = app.acquireShade();
                    loadingShade = app.acquireShade('loading');
                }

                // retrieve dialog element
                return this.retrieveDialog()

                    // pass dialog element to dialog constructor and open it
                    .then(function (elem)
                    {
                        self.dialog = self.createDialog(elem);
                        return self.dialog.open();
                    })
                    .always(
                        function ()
                        {
                            if (self.useShade)
                            {
                                app.releaseShade(loadingShade);
                            }
                        })

                    // Wait for dialog to cede control
                    .then(function ()
                    {
                        return this.promise();
                    })

                    // perform optional refresh
                    .then(function ()
                    {
                        if (self.useShade)
                        {
                            shade.addClass('refreshing');
                        }
                        Array.prototype.unshift.call(arguments, this);
                        return self.postCloseActions.apply(self, arguments)
                            .always(function ()
                            {
                                if (self.useShade)
                                {
                                    shade.removeClass('refreshing');
                                }
                            });
                    })

                    // Clean up
                    .always(function ()
                    {
                        if (self.useShade)
                        {
                            app.releaseShade(shade);
                        }
                        if (self.dialog)
                        {
                            self.dialog.destroy();
                            self.dialog = null;
                        }
                    })
                    ;
            }
        };


        /**
         * Creates a static method to load a dialog. 
         * @this {Console.Dialog} The constructor of the dialog. 
         * @param {string} template - A template for the application relative URL 
         *   from which to load the form dialog. 
         * @returns {function(UINode, Array, Object):Dialog} A static method which 
         *   loads the dialog from the specified context. The first parameter 
         *   specifies the context. The second parameter is an array of arguments to 
         *   be substituted into the URL template and passed to the constructor of 
         *   the dialog. The third parameter extends the loader.
         */
        Console.buildRemoteDialogLoadMethod = function (template)
        {
            return function (context, args, options)
            {
                var self = this;
                var app = Console.instance;
                args = args || [];
                options = options || {};

                var loader = new Console.RemoteDialogLoader(
                    app.baseUrl + Utils.sformat.apply(template, args),
                    context
                );

                loader.createDialog = function (elem)
                {
                    var dialog = Object.create(self.prototype);
                    self.apply(dialog, [elem, context].concat(args));
                    return dialog;
                };

                $.extend(loader, options);

                return loader.load();
            };
        };

        Console.CopyrightDialog = function (elem)
        {
            Console.FormDialog.call(this, elem);
        };
        Utils.inherit(Console.CopyrightDialog, Console.FormDialog);
        Console.CopyrightDialog.load = Console.buildRemoteDialogLoadMethod('config/Copyright');

        /**
         * Mixin implementing a stack of layers. There are three types of layers: 
         * shade layers, content layers, and parking layers. Layers at the top of 
         * the stack occlude layers at the bottom of the stack. 
         * 
         * A shade layer is a semi-transparent gray box which fills the entire 
         * viewport. They indicate to the end user that user interaction with 
         * anterior layers is blocked. 
         * 
         * A content layer displays visible content, such as a dialog. 
         * 
         * A parking layer holds invisible content, such as a dialog which has not 
         * yet been opened. 
         * 
         * @mixin
         */
        Console.Layers = function ()
        {
            /* 
             * Layers are children of the div.console-layers element. The layers are 
             * ordered by their position on the stack, from lowest to highest. This 
             * ordering is the same as ordering on the z-index of each layer. 
             */
            this.layers = $(document.createElement('div'))
                .addClass('console-layers')
                .appendTo($('body'));
            this.updateLayers();
        };

        Console.Layers.prototype =
        {
            constructor: Console.Layers,

            /**
             * The root element of this layers stack. 
             * @type {!jQuery}
             */
            layers: undefined,

            /**
             * The top most visible layer, or the <html> element if no visible layers 
             * present. 
             * @type {!jQuery}
             */
            topLayer: $(),

            /**
             * The z-index of the foremost content or shade layer. 
             * @type {number}
             */
            zIndex: 0,

            /**
             * Whether any layer is visible. 
             * @type {boolean}
             */
            visible: undefined,

            /**
             * Destroys this layers stack. 
             */
            destroyLayers: function ()
            {
                this.layers.remove();
            },

            /**
             * Acquires a shade layer of the specified type. If such a shade does not 
             * exist, it is automatically created. 
             * 
             * There are two types of shade layers: normal shades, and loading shades. 
             * Normal shades are pushed to the top of the current layer stack. Loading 
             * shades are pinned to the top of the layer stack, and show an loading 
             * animation. 
             *
             * @param {string=normal} type - The type of shade, either 'normal' or 
             *   'loading'. Defaults to 'normal'. 
             * @returns {!jQuery} The acquired shade layer
             */
            acquireShade: function (type)
            {
                // Default to normal shades
                type = type || 'normal';
                var shade;

                switch (type)
                {
                    case 'normal':
                        shade = this.layers.children('.shade-layer:not(.loading):last');
                        if (shade.length === 0 || shade.nextAll('.content-layer').length !== 0)
                        {
                            this.zIndex += 10;
                            shade = $('<div />')
                                .addClass('shade-layer')
                                .css('z-index', this.zIndex)
                                .data('console-layer', { refCount: 0 })
                                .appendTo(this.layers);
                        }
                        break;

                    case 'loading':
                        shade = this.layers.children('.shade-layer.loading');
                        if (shade.length === 0)
                        {
                            shade = $('<div />')
                                .addClass('shade-layer loading')
                                .css('z-index', 1000000) // a large number
                                .data('console-layer', { refCount: 0 })
                                .appendTo(this.layers);
                        }
                        break;
                }
                shade.data('console-layer').refCount += 1;

                this.updateLayers();
                return shade;
            },

            /**
             * Releases the specified shade layer. 
             * @param {!jQuery} shade - The shade layer to release
             */
            releaseShade: function (shade)
            {
                var data = shade.data('console-layer');
                data.refCount -= 1;
                if (data.refCount === 0)
                {
                    shade.remove();
                    if (!shade.hasClass('loading'))
                    {
                        this.zIndex -= 10;
                    }
                }
                this.updateLayers();
            },

            /**
             * Pushes a content layer to the top of the layer stack. 
             * @returns {!jQuery} The content layer pushed
             */
            pushContentLayer: function ()
            {
                this.zIndex += 10;
                var layer = $('<div />')
                    .addClass('content-layer')
                    .css('z-index', this.zIndex)
                    .appendTo(this.layers);
                this.updateLayers();
                return layer;
            },

            /**
             * Pops the specified content layer from the layer stack. 
             * @param {!jQuery} layer - The popped content layer
             */
            popContentLayer: function (layer)
            {
                layer.remove();
                this.zIndex -= 10;
                this.updateLayers();
            },

            /**
             * Pushes a parking layer to the top of the layer stack. 
             * @returns {!jQuery} The parking layer to push
             */
            pushParkingLayer: function ()
            {
                var layer = $('<div />')
                    .addClass('parking-layer')
                    .appendTo(this.layers);
                this.updateLayers();
                return layer;
            },

            /**
             * Pops the specified parking layer from the layer stack. 
             * @param {!jQuery} layer - The popped parking layer
             */
            popParkingLayer: function (layer)
            {
                layer.remove();
                this.updateLayers();
            },

            /**
             * Updates computed properties of the layer stack. 
             */
            updateLayers: function ()
            {
                var app = Console.instance;
                var html = $('html');

                // Determine whether any visible layers (i.e. non-parking) are present
                var oldVisible = this.visible;
                var layers = this.layers.children('.shade-layer, .content-layer');
                this.visible = layers.length !== 0;

                // Move loading shade to the end of the layers
                this.layers.children('.loading').appendTo(this.layers);

                // Save focus of the old top layer
                if (this.topLayer.is('.content-layer, html'))
                {
                    this.saveFocus(this.topLayer);
                }

                // Find the new top layer
                this.topLayer = layers.last();
                if (!this.topLayer.length)
                {
                    this.topLayer = $('html');
                }

                // Restore focus of top layer
                if (this.topLayer.is('.content-layer, html'))
                {
                    this.restoreFocus(this.topLayer);
                }

                // Lose focus if the top layer is a shade
                else if (this.topLayer.hasClass('shade-layer'))
                {
                    var active = document.activeElement;
                    if (active && !$(active).is('body') && active.blur) // Avoid blurring body in IE
                    {
                        active.blur();
                    }
                }

                // Show the layers root element when it contains visible layers
                this.layers.toggle(this.visible);

                // Hide activity level scrollbar if there are visible layers
                var hasScroll = html[0].clientHeight < html[0].scrollHeight;
                html.css('overflow', this.visible ? 'hidden' : 'auto');

                // Replace vertical scrollbar with right padding if the scrollbars are hidden
                html.css('padding-right', hasScroll && this.visible ? app.getScrollBarWidth() : '');

                // Only show the top most shade, if there are multiple shade layers
                var shade = this.layers.children('.shade-layer');
                shade.slice(0, shade.length - 1).hide();
                shade.eq(shade.length - 1).show();

                // Only the top content layer can have scrollbars
                var contentLayers = this.layers.children('.content-layer');
                for (var i = 0; i < contentLayers.length - 1; i++)
                {
                    contentLayers.eq(i).css('overflow', 'hidden');
                }
                contentLayers.last().css('overflow', 'auto');

                // On leading and trailing edges, attach the focus event handler which 
                // forces focus to the top most visible layer
                if (!oldVisible && this.visible)
                {
                    $(document).on('focusin.console-layers', this.onDocumentFocusin.bind(this));
                }
                if (!this.visible && oldVisible)
                {
                    $(document).off('focusin.console-layers');
                }
            },

            /**
             * Saves which element is currently focused in the specified layer as a 
             * property of the content layer. 
             * @param {!jQuery} layer - The content layer or <html> element
             */
            saveFocus: function (layer)
            {
                // IE frequently sets non-focusable elements as the active element. We check for that here. 
                if ($(document.activeElement).is(':focusable'))
                {
                    layer.data('focus.console-layers', document.activeElement);
                }
            },

            /**
             * Restores focus to the element in a layer saved via saveFocus. 
             * @param {!jQuery} layer - The content layer or <html> element
             */
            restoreFocus: function (layer)
            {
                var activeElem = layer.data('focus.console-layers');
                if ($(activeElem).closest(layer).length)
                {
                    try
                    {
                        activeElem.focus();
                    } catch (ex) { }
                }
            },

            /**
             * Attempts to focus the specified element in the specified layer. If the 
             * layer at the top of of the layer stack, the element is focused. 
             * Otherwise, the element will not be focused until layer rises to the top. 
             * @param {!jQuery} layer - The content layer or <html> element
             * @param {!HTMLElement} elem - The element to focus
             */
            setFocus: function (layer, elem)
            {
                if (layer[0] === this.topLayer[0])
                {
                    try
                    {
                        elem.focus();
                    } catch (ex) { }
                }
                else
                {
                    layer.data('focus.console-layers', elem);
                }
            },

            /* Forces focus to the top most visible layer */
            onDocumentFocusin: function (event)
            {
                var self = this;
                var app = Console.instance;

                // Stop if focus is in top layer
                if ($(event.target).closest(this.topLayer).length)
                {
                    return;
                }

                // Redirect focus if focus is not in top layer
                if (this.topLayer.is('.shade-layer'))
                {
                    event.preventDefault();
                    var active = document.activeElement;
                    if (active && !$(active).is('body')) // Avoid blurring body in IE
                    {
                        active.blur();
                    }
                }
                else if (this.topLayer.is('.content-layer'))
                {
                    // Locate the dialog of the top most content layer
                    var dialogs = app.activity.dialogs;
                    var dialog = Utils.find.call(dialogs,
                        function (dialog)
                        {
                            return dialog.elem.closest(self.topLayer).length !== 0;
                        });

                    // If it exists, focus its first focusable element
                    if (dialog)
                    {
                        event.preventDefault();
                        dialog.focusFirst();
                    }
                }
            }
        };


        /**
         * Mixin which implements the RevTrack interface on an UI node by storing 
         * the revision number in the data-rev attribute of the wrapped element. 
         *
         * @mixin
         * @this {!UINode} The UI node on which to implement the RevTrack interface.
         */
        Console.tracksRevision = function ()
        {
            // gets the current revision
            this.rev = function ()
            {
                return this.elem.attr('data-rev');
            };

            // sets the latest seen revision
            this.setHeadRev = function (headRev)
            {
                if (headRev !== undefined)
                {
                    this.headRev = headRev;
                }
            };

            // updates the current revision to the latest seen revision
            this.updateRev = function ()
            {
                this.elem.attr('data-rev', this.headRev);
            };
        };

        /**
         * Mixin which implements the RevTrack interface by redirecting calls to 
         * another object which implements the RevTrack interface. 
         *
         * @mixin
         * @this {!Object} The object on which to implement the RevTrack interface.
         * @param {!RevTrack} revTrack - The other RevTrack interface. 
         */
        Console.redirectRevision = function (revTrack)
        {
            if (revTrack.rev)
            {
                this.rev = revTrack.rev.bind(revTrack);
                this.setHeadRev = revTrack.setHeadRev.bind(revTrack);
                this.updateRev = revTrack.updateRev.bind(revTrack);
            }
        };

        /**
         * Creates a confirmation dialog with the specified title and content. The 
         * dialog has an accept and a cancel button. 
         * 
         * @param {string} title - The title appears in the header of the dialog box. 
         *
         * @param {string|!jQuery} content - The content appears in the body of the 
         *   dialog box. 
         * 
         * @returns {!Console.Dialog} The created dialog box. 
         */
        Console.createConfirmationDialog = function (title, content)
        {
            title = title || '';
            if (typeof content === 'string')
            {
                content = $('<p />').text(content);
            }

            var section = $('<section><header /><footer /></section>');
            var h1 = $('<h1 />').text(title).appendTo(section.children('header'));
            content.insertAfter(section.children('header'));

            var buttons = $('<div class="dialog-actions" />').appendTo(section.children('footer'));
            var acceptButton = $('<button data-action=submit>Accept</button>')
                .appendTo(buttons);
            $('<button data-action=close autofocus>Cancel</button>')
                .appendTo(buttons);

            return new Console.Dialog(section);
        };

        /**
         * Creates a message dialog with the specified title and content. The dialog 
         * has a close button in its footer. 
         * 
         * @param {string|!jQuery} title - The title appears in the header of the dialog box. 
         *
         * @param {string|!jQuery} content - The content appears in the body of the 
         *   dialog box. 
         *
         * @returns {!Console.Dialog} The created dialog box. 
         */
        Console.createMessageDialog = function (title, content)
        {
            var section = $('<section><header /><footer /></section>');
            if (typeof title === 'string')
            {
                $('<h1 />').text(title).appendTo(section.children('header'));
            }
            else if (title.length)
            {
                section.children('header').replaceWith(title);
            }

            if (typeof content === 'string')
            {
                content = $('<p />').text(content);
            }
            content.insertAfter(section.children('header'));

            var buttons = $('<div class="dialog-actions" />').appendTo(section.children('footer'));
            $('<button data-action=close>Close</button>')
                .appendTo(buttons);

            return new Console.Dialog(section);
        };


        /**
         * A timer which fires on a periodic interval. 
         * @param {!Object} options - Options for this timer. See below for an 
         *   explaination of the available options. 
         */
        Console.Timer = function (options)
        {
            var defaults =
            {
                /**
                 * The period of the timer, in seconds. If both period and freq are 
                 * specified, this takes precedence. 
                 * @type {number}
                 */
                period: 1.0,

                /**
                 * The frequency of the timer, in hertz. 
                 * @type {number}
                 */
                freq: 1.0,

                /**
                 * The action to perform when the timer fires. 
                 * @type {function()}
                 */
                onTick: function () { }
            };

            this.period = options.period || (options.freq ? 1.0 / options.freq : null) || defaults.period;
            this.onTick = options.onTick;
        };

        Console.Timer.prototype =
        {
            constructor: Console.Timer,

            /**
             * The period of the timer, in seconds. 
             * @type {number}
             */
            period: undefined,

            /**
             * The action to perform when the timer fires. 
             * @type {function()}
             */
            onTick: undefined,

            /**
             * The timeout ID of the current timeout, or null if the timer is stopped. 
             * @type {?number}
             */
            timer: null,

            // Callback of the timeout
            tick: function ()
            {
                this.onTick();
                this.timer = window.setTimeout(this.tick.bind(this), 1000 * this.period);
            },

            /**
             * Starts this timer. 
             */
            start: function (skipFirst)
            {
                if (this.state() === 'running')
                {
                    return;
                }

                if (skipFirst === true)
                {
                    this.timer = window.setTimeout(this.tick.bind(this), 1000 * this.period);
                }
                else
                {
                    this.tick();
                }
            },

            /**
             * Stops this timer. 
             */
            stop: function ()
            {
                if (this.state() === 'running')
                {
                    window.clearTimeout(this.timer);
                    this.timer = null;
                }
            },

            /**
             * Toggles whether this timer is running. 
             * @param {?boolean} b - Whether the timer should be running, or the 
             *   opposite of the current timer state if not specified. 
             */
            toggle: function (b)
            {
                if (b === undefined)
                {
                    b = this.state() === 'stopped';
                }

                (b ? this.start : this.stop).call(this);
            },

            /**
             * Returns the state of this timer, either 'running' or 'stopped'. 
             * @returns {string}
             */
            state: function ()
            {
                return this.timer !== null ? 'running' : 'stopped';
            }
        };


        /**
         * A timer which determines the next fire time from the last fire time. 
         * @param {!Object} options - Options for this timer. See below for an 
         *   explaination of the available options. 
         */
        Console.ServoTimer = function (options)
        {
            var defaults =
            {
                /**
                 * The period of the timer, in seconds. If both period and freq are 
                 * specified, this takes precedence. 
                 * @type {number}
                 */
                period: 1.0,

                /**
                 * The frequency of the timer, in hertz. 
                 * @type {number}
                 */
                freq: 1.0,

                /**
                 * The action to perform when the timer fires. 
                 * @type {function()}
                 */
                onTick: function () { }
            };

            this.period = options.period || (options.freq ? 1.0 / options.freq : null) || defaults.period;
            this.onTick = options.onTick;
        };

        Console.ServoTimer.prototype =
        {
            constructor: Console.ServoTimer,

            /**
             * The period of the timer, in seconds. 
             * @type {number}
             */
            period: undefined,

            /**
             * The last fire time, in UNIX time. 
             * @type {number}
             */
            last: 0,

            /**
             * The state of the timer, either 'started' or 'stopped'
             * @type {string}
             */
            _state: 'stopped',

            /**
             * The action to perform when the timer fires. 
             * @type {function()}
             */
            onTick: undefined,

            /**
             * The timeout ID of the current timeout, or null if there is no current 
             * timeout. 
             * @type {?number}
             */
            timer: null,

            /**
             * Calls onTick if appropriate, and recomputes the next fire time from the 
             * last fire time. 
             */
            update: function ()
            {
                var self = this;

                if (this.timer !== null)
                {
                    window.clearTimeout(this.timer);
                    this.timer = null;
                }

                if (this._state === 'running')
                {
                    var next = this.last + 1000 * this.period;
                    if (next < Date.now())
                    {
                        this.last = Date.now();
                        next = this.last + 1000 * this.period;
                        this.onTick();
                    }

                    this.timer = window.setTimeout(self.update.bind(self), next - this.last);
                }
            },

            /**
             * Starts this timer. 
             */
            start: function ()
            {
                this._state = 'running';
                this.update();
            },

            /**
             * Stops this timer. 
             */
            stop: function ()
            {
                this._state = 'stopped';
                this.update();
            },

            /**
             * Toggles whether this timer is running. 
             * @param {?boolean} b - Whether the timer should be running, or the 
             *   opposite of the current timer state if not specified. 
             */
            toggle: function (b)
            {
                if (b === undefined)
                {
                    b = this.state() === 'stopped';
                }

                (b ? this.start : this.stop).call(this);
            },

            /**
             * Resets the countdown for the timer, without firing the timer. 
             */
            touch: function ()
            {
                this.last = Date.now();
                this.update();
            },

            /**
             * Returns the state of this timer, either 'running' or 'stopped'. 
             * @returns {string}
             */
            state: function ()
            {
                return this._state;
            },

            /**
             * Sets the period of the timer. 
             * @param {number} period
             */
            setPeriod: function (period)
            {
                this.period = period;
                this.update();
            },

            /**
             * Sets the frequency of the timer. 
             * @param {number} freq
             */
            setFreq: function (freq)
            {
                this.period = 1.0 / freq;
                this.update();
            }
        };


        /**
         * Base, abstract class for activities. Activites are UINodes and wrap around
         * the root <html> element. 
         * @constructor
         * @extends Console.UINode
         * @mixes Console.asActionable
         */
        Console.Activity = function ()
        {
            var self = this;
            var app = Console.instance;
            Console.UINode.call(this, $('html'));
            Console.asActionable.call(this);

            // Initialize application level navigation
            this.consoleNav = new ConsoleNav(app, $('.console-nav'));
            app.nav = this.consoleNav;
            if (app.nav.currentGroup)
            {
                app.nav.currentGroup.setActivityName(app.activityName);
            }


            // Attach resize handler. This particular method of attaching the resize 
            // handler avoids a bug on IE8 where resizing an element in updateLayout 
            // triggers the resize event, resulting in an infinite loop. 
            var $window = $(window);
            var attachResize = function ()
            {
                $window.one('resize.console-activity', function ()
                {
                    self.updateLayout();
                    self.updateScroll();
                    window.setTimeout(attachResize, 0);
                });
            };
            attachResize();

            // Display a tooltip for cut off strings as they are moused over. 
            this.elem.on('mouseover.console-activity', '.overflow-ellipsis', function (event)
            {
                var $this = $(this);
                if (this.offsetWidth < this.scrollWidth
                    && !$this.hasClass('no-tooltip'))
                {
                    // trim text, due to copious whitespace produced from *.cshtml files
                    var title = self.getHoverText($this);
                    this.setAttribute('title', title);
                }
                else if (!$this.hasClass('has-hover-text'))
                {
                    this.removeAttribute('title');
                }
            });


            // Update the url of page loading links on mouseover and focus
            this.elem.on('mouseover.console-activity, focus.console-activity',
                'a[data-action=loadPage]',
                function (event)
                {
                    if (!this.hasAttribute('data-absolute-url'))
                    {
                        self.resolveLoadPageAction(this);
                    }
                });

            this.loadingWheel = this.elem.find('.loading-wheel-activity');
            this.wheelAnimator = $({ theta: 0 });
        };

        Console.Activity.prototype =
        {
            /**
             * The console level navigation. 
             * @type {!ConsoleNav}
             */
            consoleNav: undefined,

            /**
             * The activity level navigation. 
             * @type {Console.ActivityNav}
             */
            nav: null,

            /**
             * The page, or null if the activity does not have a page or has multiple 
             * pages. 
             * @type {Console.Page}
             */
            page: null,

            /**
             * The collection of dialogs in the activity, including dialogs not open. 
             * @type {!Array.<Console.Dialog>}
             */
            dialogs: [],

            /**
             * The ratio of the minimum footer height to the height of the closest 
             * scrollable region. 
             * @type {number}
             */
            crawlRatio: 0.5,

            loadingWheel: undefined,
            wheelAnimator: undefined,

            // Destroys this activity. 
            destroy: function ()
            {
                $(window).off('.console-activity');
                this.elem.off('.console-activity');

                if (this.page)
                {
                    this.page.destroy();
                }

                // Close all open dialogs. The caller of dialog constructors are 
                // responsible for destroying them. 
                this.dialogs.forEach(function (dialog)
                {
                    if (dialog.isOpen())
                    {
                        dialog.close();
                    }
                });

                this.consoleNav.destroy();
                delete Console.instance.nav;

                Console.UINode.prototype.destroy.call(this);
            },

            /**
             * Activity specific logic for loading a page. The page to load is 
             * specified by the page descriptor. This method is called by 
             * Console.App.prototype.loadPage .
             * 
             * This default implementation performs a full refresh. Derived classes 
             * may override this behavior and load pages asynchronously. 
             * 
             * @param {!PageDesc} pageDesc - The page descriptor. 
             * @returns {!Promise} A promise that is resolved when the new page loads. 
             */
            loadPageHelper: function (pageDesc)
            {
                var app = Console.instance;
                var urlNew;

                if (global.location.protocol !== 'file:')
                {
                    urlNew = pageDesc.absoluteUrl;
                }
                else
                {
                    urlNew = app.baseUrl + pageDesc.url + '.html';
                }

                if (urlNew)
                {
                    window.location = urlNew;
                }

                return Deferred.bottomUnit();
            },

            /**
             * Loads the specified page. This method is intended to be invoked only by 
             * clicking an actionable element. To programatically load a page, use 
             * Console.App.prototype.loadPage .
             * 
             * @param {Event} event - The click event
             * @see Console.App.prototype.load
             */
            loadPage: function (event, target)
            {
                var app = Console.instance;
                var $html = $('html');
                $html.addClass('progress');
                var pageDesc = this.resolveLoadPageAction(target[0]);
                app.loadPage(pageDesc)
                    .always(
                        function ()
                        {
                            $html.removeClass('progress');
                        });
            },

            /**
             * Resolves a page descriptor embedded in a element with the loadPage action. 
             * 
             * @param {!DOMElement} elem - The element with the loadPage action
             * @returns {!PageDesc} The resolved page descriptor. 
             */
            resolveLoadPageAction: function (elem)
            {
                var app = Console.instance;

                // Build page descriptor
                var pageDesc = {};
                var length = elem.attributes.length;
                for (var i = 0; i < length; i++)
                {
                    var attr = elem.attributes[i];
                    if (attr.name.lastIndexOf('data-', 0) === 0)
                    {
                        var propName = $.camelCase(attr.name.substring(5));
                        pageDesc[propName] = attr.value;
                    }
                }
                delete pageDesc.action;
                delete pageDesc.absoluteUrl;

                // Resolve the page descriptor
                app.resolve(pageDesc);

                // Put the computed URL back onto the element
                if (elem.nodeName === 'A')
                {
                    elem.setAttribute('href', pageDesc.absoluteUrl);
                }
                elem.setAttribute('data-absolute-url', pageDesc.absoluteUrl);

                return pageDesc;
            },

            /**
             * Updates certain layout properties which must be recomputed when the 
             * window scrolls. 
             */
            updateScroll: function ()
            {
                var app = Console.instance;
                var header = this.elem.find('body > header');
                var headerWidth = header.width();
                var $window = $(window);

                // Keep the activity navigation from vertically overflowing the screen
                if (this.nav)
                {
                    var consoleNavHeight = $('.console-nav').height();
                    var windowHeight = $window.height();
                    this.nav.elem.height(windowHeight - consoleNavHeight);
                    this.nav.updateLayout();
                }

                // If the header overflows vertically, scroll it using the window scrollbar
                header.scrollTop($window.scrollTop());
            },

            updateLayout: function ()
            {
                // If the header overflows vertically, scroll it using the window scrollbar
                var header = this.elem.find('body > header');
                header.scrollTop($(window).scrollTop());

                // Update layout of console level navigation
                this.consoleNav.updateLayout();

                // Update layout of dialogs
                for (var i = 0; i < this.dialogs.length; i++)
                {
                    this.dialogs[i].updateLayout();
                }

                // Add crawl space beneath the page, by assigning a minimum height to the 
                // activity footer. Ensure that the crawl space is tall enough to scroll 
                // the console level navigation, if needed. 
                if (this.page && !this.page.elem.hasClass('no-crawl-space'))
                {
                    var windowHeight = this.elem[0].clientHeight;
                    var navBottom = this.consoleNav.elem.position().top + this.consoleNav.elem.outerHeight(true);
                    var pageBottom = this.page.elem.position().top + this.page.elem.outerHeight(true);
                    var footer = this.elem.find('footer[role=contentinfo]');
                    var notice = footer.find('.copyright-notice');
                    var noticeHeight = notice.length ? notice.innerHeight() : 0;
                    var space = Math.max(
                        this.crawlRatio * windowHeight - noticeHeight,
                        navBottom - pageBottom
                    );
                    var paddingTop = Math.max(space - footer.height(), 0);
                    footer.css('padding-top', paddingTop);
                    var footerBottom = footer.offset().top + footer.height() + paddingTop;
                    if (footerBottom < windowHeight)
                    {
                        paddingTop += (windowHeight - footerBottom);
                        footer.css('padding-top', paddingTop);
                        footer.css('margin-top', '-2em');
                    }
                }

                // Update layout of activity navigation if it exists
                if (this.nav) { this.nav.updateLayout(); }

                // Update layout of page if it exists
                if (this.page) { this.page.updateLayout(); }

                if (this.consoleNav && this.consoleNav.resize)
                {
                    this.consoleNav.resize();
                }
            },

            switchLocale: function ()
            {
                var loader = new Console.SwitchLocale.Loader(this, []);
                loader.load();
            },

            openCopyright: function ()
            {
                Console.CopyrightDialog.load(this, []);
            },

            getHoverText: function (elem)
            {
                return elem.text().trim().replace(/\s+/, ' ');
            },

            insertText: function (elemId, text)
            {
                var txtarea = document.getElementById(elemId);
                var scrollPos = txtarea.scrollTop;
                var strPos = txtarea.selectionStart;

                var front = txtarea.value.substring(0, strPos);
                var selected = txtarea.value.substring(strPos, txtarea.selectionEnd);
                var back = txtarea.value.substring(txtarea.selectionEnd, txtarea.value.length);
                if (((back.indexOf(">") > -1) && back.substring(0, back.indexOf(">>")).indexOf("<<") === -1) || selected.indexOf('>') > -1)
                {
                    front = txtarea.value;
                    back = '';
                    strPos = txtarea.value.length;
                }
                txtarea.value = front + text + back;
                txtarea.selectionStart = strPos + 16;
                strPos = strPos + text.length;
                txtarea.selectionEnd = txtarea.selectionStart + 3;
                txtarea.focus();
                txtarea.scrollTop = scrollPos;
            },

            addLink: function (event, target)
            {
                var elemId = target.attr("elemId");
                var linkTemp = '<<Link="https://***", Text="***">>';
                this.insertText(elemId, linkTemp);
            },


            initializeLoadingWheel: function (activityName, makeLayer)
            {
                if (activityName === undefined)
                {
                    activityName = Console.instance.activityName;
                }

                if (makeLayer === undefined)
                {
                    makeLayer = true;
                }

                var self = this;
                if (this.loadingWheel && this.loadingWheel.length)
                {


                    if (!this.loadingWheel.children('span.loading-indicator').length)
                    {
                        var $svg = this.loadingWheel.find('svg').has('g.svg-loading-wheel');
                        var $text = $(document.createElement('span'));
                        $text.text(activityName + ' is loading\u2026');
                        $text.addClass('header-text');
                        $text.addClass('loading-indicator');
                        $text.insertAfter($svg);
                    }
                    this.loadingWheel.fadeIn(1500).toggleClass("hidden", true);
                }
            },

            startLoadingWheel: function ()
            {
                var self = this;

                if (this.loadingWheel && this.loadingWheel.length)
                {
                    this.loadingWheel.toggleClass('hidden', false);
                    var to = { theta: 36000 };
                    var transformHead = 'rotate(';
                    var transformTail = ' 0 0)';
                    var $svg = this.loadingWheel.children('svg').has('g.svg-loading-wheel');
                    $svg.toggleClass('hidden', false);
                    var gTag = $svg.children('g.svg-loading-wheel')[0];

                    animate_loop = function ()
                    {
                        self.wheelAnimator.animate(to,
                            {
                                duration: 90000,
                                easing: 'linear',
                                step: function (now, fx)
                                {
                                    now = +now;
                                    var nowSnap = (now - (now % 30)) % 360;
                                    var nowString = (+nowSnap).toString(10);
                                    gTag.setAttribute('transform', transformHead + nowString + transformTail);
                                },
                                complete: function ()
                                {
                                    $(gTag).removeAttr('transform');
                                    self.wheelAnimator = $({ theta: 0 });
                                    animate_loop();
                                }
                            });
                    }

                    animate_loop();


                }

            },

            hideLoadingWheel: function ()
            {
                this.loadingWheel.toggleClass("hidden", true);
            }

        };
        Utils.inherit(Console.Activity, Console.UINode);


        /**
         * Base class for pages. Pages are UINodes and wrap around <article> 
         * elements. 
         * @param {!jQuery} elem - The root element of the page. 
         */
        Console.Page = function (elem)
        {
            Console.Section.call(this, elem);
        };

        Console.Page.prototype =
        {
            // Destroys this page. 
            destroy: function ()
            {
                Console.Section.prototype.destroy.call(this);
            },

            /**
             * Refreshes this page. This default implementation replaces the entire 
             * <article> element with one retrieved from the server. 
             * @returns {!Promise} A promise which completes when the refresh completes. 
             */
            refresh: function ()
            {
                var self = this;
                var app = Console.instance;

                return this.requestPage({})
                    .done(function (elem, props)
                    {
                        self.destroy();
                        self.elem.replaceWith(elem);
                        document.title = props.title;
                        self.constructor.call(self, elem);

                        var pageDesc = {};
                        app.resolve(pageDesc);
                        app.saveLasts(pageDesc);
                        if (app.nav && app.nav.update)
                        {
                            app.nav.update();
                        }

                        // Replace the top of the history stack
                        if (app.useHistory)
                        {
                            window.history.replaceState({ pageDesc: pageDesc }, document.title, pageDesc.absoluteUrl);
                        }

                        app.activity.updateLayout();
                    })
                    .always(
                        function ()
                        {
                            if (app && app.nav && app.nav.resize)
                            {
                                app.nav.resize();
                            }
                        });
            }
        };
        Utils.inherit(Console.Page, Console.Section);




        /**
         * Polyfill for the <details> element. This jQuery plugin implements the 
         * behavior, layout, and styling of the <details> and <summary> elements. 
         * This implementation overrides the existing behavior and styling of 
         * <details> even on browsers which support <details> .
         */
        (function ($, undefined)
        {
            var pluginName = 'details';

            var methods =
            {
                /**
                 * Initializes this plugin on a list of <details> elements. 
                 * @this {jQuery} The <details> elements. 
                 */
                init: function ()
                {
                    return this.each(function ()
                    {
                        var $this = $(this);
                        var summary = $this.children('summary');

                        summary.on('click.' + pluginName, function (event)
                        {
                            // override browsers which already support <details> .
                            event.preventDefault();

                            var isOpen = plugin.call($this, 'isOpen');
                            plugin.call($this, 'toggle', !isOpen);
                        });

                        var marker = summary.find('.details-marker');
                        if (!marker.length)
                        {
                            marker = $(document.createElement('a'))
                                .attr('href', '#')  // Required for Space and Return to trigger click events
                                .addClass('details-marker');

                            var $svg = Utils.Shapes.getDivot();
                            $svg.appendTo(marker);
                            marker.prependTo(summary);
                        }

                        summary.attr('tabindex', -1);

                        var isOpen = plugin.call($this, 'isOpen');
                        plugin.call($this, 'toggle', isOpen);
                    });
                },

                /**
                 * Destroys this plugin on a list of <details> elements. 
                 * @this {jQuery} The <details> elements. 
                 * @param {boolean=true} keepVisuals Whether to keep visual elements 
                 *   created by this plugin
                 */
                destroy: function (keepVisuals)
                {
                    if (typeof keepVisuals === 'undefined')
                    {
                        keepVisuals = true;
                    }

                    var summary = this.children('summary');
                    summary.off('click.' + pluginName);
                    if (!keepVisuals)
                    {
                        summary.children('.details-marker').remove();
                    }
                    return this;
                },

                /**
                 * Whether the first <details> element is open. 
                 * @returns {boolean}
                 */
                isOpen: function ()
                {
                    return this.first().attr('open') === 'open';
                },

                /**
                 * Toggles whether a list of <details> elements is open. 
                 * @this {jQuery} The <details> elements. 
                 * @param {boolean=} open - Whether to open or close the elements. If 
                 * unspecified, the elements are inverted from their previous state. 
                 */
                toggle: function (open_)
                {
                    return this.each(function ()
                    {
                        var $this = $(this);

                        var open = typeof open_ === 'boolean'
                            ? open_
                            : $this.attr('open') !== 'open';

                        if (open)
                        {
                            $this.attr('open', 'open');
                        }
                        else
                        {
                            $this.removeAttr('open');
                        }

                        /*
                         * The not-open class is provided for convinence on IE8. Code 
                         * targeting newer browsers should use :not([open]) instead of 
                         * .not-open .
                         */
                        $this.toggleClass('not-open', !open)
                            .trigger('change');
                    });
                },

                /**
                 * Opens a list of <details> elements. 
                 * @this {jQuery} The <details> elements. 
                 */
                open: function ()
                {
                    return plugin.call(this, 'toggle', true);
                },

                /**
                 * Closes a list of <details> elements. 
                 * @this {jQuery} The <details> elements. 
                 */
                close: function ()
                {
                    return plugin.call(this, 'toggle', false);
                }
            };

            var plugin = $.arityplugin(pluginName, methods);
            $.fn[pluginName] = plugin;
        })($);





        /**
         * Base class for page sections. Page sections are UINodes which wrap around 
         * <section> elements. 
         * @constructor
         * @extends Console.Section
         * @param {!jQuery} elem - The root element of the page section. 
         */
        Console.PageSection = function (elem)
        {
            Console.Section.call(this, elem);

            this.body = this.elem.children('.body');

            // If body does not exist, create it
            if (!this.body.length)
            {
                this.body = $(document.createElement('div')).addClass('body');

                var children = this.elem.children();
                var seen = false;
                for (var i = 0; i < children.length; i++)
                {
                    var child = $(children[i]);
                    if (child.is('header'))
                    {
                        seen = true;
                    }
                    else if (child.is('footer'))
                    {
                        break;
                    }
                    else if (seen && !child.hasClass('notify-box'))
                    {
                        child.appendTo(this.body);
                    }
                }

                // Insert the body before the footer, if there is a footer. Otherwise, 
                // place the body at the end. 
                var footer = this.getFooter();
                if (footer.length)
                {
                    this.body.insertBefore(footer);
                }
                else
                {
                    this.body.appendTo(this.elem);
                }
            }

            this.paddingTopDirty = true;
        };

        Console.PageSection.prototype =
        {
            /**
             * The body contains the content of the page section and has a stylized
             * left border. 
             * @type {!jQuery}
             */
            body: undefined,

            paddingTopDirty: false,

            // Destroys this page section. 
            destroy: function ()
            {
                Console.Section.prototype.destroy.call(this);
            },

            /**
             * Returns the body of this page section. 
             * @returns {!jQuery}
             */
            getBody: function ()
            {
                return this.body;
            },

            /**
             * Refreshes this section. This implementation refreshing the page 
             * containing this section. Derived classes may override this behavior. 
             * @returns {!jQuery} A promise which resolves after the page is refreshed. 
             */
            refresh: function ()
            {
                var app = Console.instance;
                var page = app.activity.page;
                return page.refresh();
            },

            toggle: function ()
            {
                Console.Section.prototype.toggle.apply(this, arguments);
                if (this.isOpen())
                {
                    this.updatePaddingTop();
                }
            },

            updateLayout: function ()
            {
                var app = Console.instance;

                if (!this.elem.hasClass('with-support'))
                {
                    Console.Section.prototype.updateLayout.call(this);
                    if (app && app.nav && app.nav.resize)
                    {
                        app.nav.resize();
                    }
                }

                this.updatePaddingTop();
            },

            /**
             * Updates the size of the top padding so that the content within the body 
             * is vertically centered. 
             */
            updatePaddingTop: function ()
            {
                if (!this.paddingTopDirty) return;
                if (this.openable && !this.isOpen()) return;
                this.paddingTopDirty = false;

                var minBodyHeight = 52;
                var minPadding = 3;
                var paddingTop = parseInt(this.body.css('padding-top'), 10);

                var child = this.body.children(':not(.border-image):last');
                var childBottom;
                if (child.length)
                {
                    childBottom = child.position().top + child.outerHeight(true);
                }
                else
                {
                    childBottom = minPadding;
                }
                var contentHeight = childBottom - paddingTop;

                var delta = Math.max(0, contentHeight - minBodyHeight);
                this.body.css('padding-top', Math.max(-delta / 2, minPadding));
            }
        };
        Utils.inherit(Console.PageSection, Console.Section);




        /**
         * Base class for activity level navigation bars. These navigation bars wrap 
         * around <nav> elements. 
         * @constructor
         * @extends Console.UINode
         * @extends Console.asActionable
         * @param {!jQuery} elem - The root element of the navigation bar
         */
        Console.ActivityNav = function (elem)
        {
            Console.UINode.call(this, elem);
            Console.asActionable.call(this);
            this.scroll = this.elem.find('.scroll');

            // Create scrollbar
            var barElem = $(document.createElement('div')).insertAfter(this.scroll);
            this.scrollbar = new Console.Scrollbar(barElem, this.scroll);

            this.searchElem = this.elem.find('.search');
            this.searchElem.on('textchange.console-activity-nav', this.updateList.bind(this));

            // Clicking anywhere in the list entry should follow the link if there is one
            this.scroll.find('.list-entry').on('click.console-activity-nav',
                function (event)
                {
                    event.preventDefault();
                    var $entry = $(this);
                    var $a = $entry.children('a');
                    if ($a.length && !$entry.hasClass('form-divot'))
                    {
                        $a[0].click();
                    }
                });
        };

        Console.ActivityNav.prototype =
        {
            /**
             * The main list. 
             * @type {!Console.List}
             */
            list: undefined,

            /**
             * The scrollable region containing the main list, if it exists. 
             * @type {!jQuery}
             */
            scroll: undefined,

            /**
             * The scrollbar in the scrollable region, if it exists. 
             * @type {Console.Scrollbar}
             */
            scrollbar: undefined,

            /**
             * The search box. 
             * @type {!jQuery}
             */
            search: undefined,

            searchElem: undefined,

            searchPlaceholder: undefined,

            /**
             * Whether the scroll region needs to center on the selected item in the 
             * next updateLayout. 
             * @type {boolean}
             */
            needNormalize: false,

            destroy: function ()
            {
                this.searchElem.off('.console-activity-nav');
                if (this.searchPlaceholder)
                {
                    this.searchPlaceholder.destroy();
                }

                if (this.scrollbar)
                {
                    this.scrollbar.destroy();
                    this.scrollbar.elem.remove();
                }

                if (this.scroll)
                {
                    this.scroll.find('.list-entry').off('.console-activity-nav');
                }
                Console.UINode.prototype.destroy.call(this);
            },

            /**
             * Selects the specified list item. 
             * @param {jQuery|Event|string} - the list item
             * @returns {ListItem} The newly selected list item, if it exists
             */
            select: function (id)
            {
                var item = this.list.select(id);
                var app = Console.instance;
                if (app && app.activity && app.activity.page)
                {
                    app.activity.page.updateLayout();
                }
                if (app && app.nav && app.nav.resize)
                {
                    app.nav.resize();
                }
                this.updateLayout();
                return item;
            },

            updateList: function ()
            {
                var valBase = this.searchElem.val();
                var searchVal = $.trim(valBase.toLowerCase());
                if (this.searchPlaceholder && valBase.indexOf(this.searchPlaceholder.escapeChar) === 0)
                {
                    searchVal = '';
                }

                var count = 0;
                this.list.findAll().each(function ()
                {
                    var $this = $(this);
                    var text = $this.text().toLowerCase();
                    var visible = text.indexOf(searchVal) !== -1;

                    $this.toggle(visible);
                    count += visible;
                });

                this.elem.find('.no-results').toggle(count === 0);
                this.updateLayout();
            },

            toggleList: function (event, target)
            {
                var outerListElem = target.closest('li');
                var schemaName = outerListElem.attr('data-schema-name');

                outerListElem.toggleClass('open');
                if (outerListElem.hasClass('open'))
                {
                    this.elem.find('.view-name[data-schema-name=' + schemaName + ']').removeClass('hidden');
                }
                else
                {
                    this.elem.find('.view-name[data-schema-name=' + schemaName + ']').addClass('hidden');
                }

                this.updateLayout();
            },

            updateLayout: function ()
            {
                if (this.scroll.length)
                {
                    var scrollOffset = this.scroll.offset().top;
                    var windowHeight = $(window).height();
                    var scrollHeight = this.scroll.height();

                    var height = windowHeight - scrollOffset + window.pageYOffset;
                    this.scroll.height(height);

                    if (this.scrollbar)
                    {
                        if (!this.forced)
                        {
                            Utils.forceComputation(this.scrollbar.elem[0]);
                            this.forced = true;
                        }

                        this.scrollbar.elem.height(height);
                        this.scrollbar.update();
                    }

                    if (this.needNormalize)
                    {
                        this.list.normalize();
                        this.needNormalize = false;
                    }
                }
            }
        };
        Utils.inherit(Console.ActivityNav, Console.UINode);

        // A control for numeric input fields with attached increment and decrement buttons
        // @param elem {jquery} - root div element of the field,
        //   must have three child elements: an input field, an increment button (Html.IncrementArrowButton),
        //   and a decrement button (Html.DecrementArrowButton)
        // @param stepSize {int} - value by which to increment or decrement the input field value
        // @param lowerBound {int} - lower bound for the input field value
        // @param upperBound {int} - upper bound for the input field value
        Console.BoundedIncrementDecrement = function (elem, stepSize, lowerBound, upperBound)
        {
            Console.UINode.call(this, elem);
            Console.asActionable.call(this);
            this.valueElem = this.elem.children('input');
            this.stepSize = stepSize;
            this.lowerBound = lowerBound;
            this.upperBound = upperBound;
        };
        Console.BoundedIncrementDecrement.prototype =
        {
            valueElem: undefined,
            stepSize: undefined,
            upperBound: undefined,
            lowerBound: undefined,

            increment: function ()
            {
                var value = this.valueElem.val();
                if (value && value.length)
                {
                    this.valueElem.val(Math.min(parseInt(value) + parseInt(this.stepSize), parseInt(this.upperBound)));
                }
            },

            decrement: function ()
            {
                var value = this.valueElem.val();
                if (value && value.length)
                {
                    this.valueElem.val(Math.max(parseInt(value) - parseInt(this.stepSize), parseInt(this.lowerBound)));
                }
            },

            getValue: function ()
            {
                return this.valueElem.val();
            },

            destroy: function ()
            {
                Console.UINode.prototype.destroy.call(this);
            }
        };
        Utils.inherit(Console.BoundedIncrementDecrement, Console.UINode);

        // A control for bounded integer input fields represented by a slider widget
        // @param elem {jquery} - root div element of the field, must have four child elements (created using
        //   Html.Slider): a hidden input field, a span containing the minimum value as its inner HTML, an anchor
        //   tag containing the svg element representing the slider, and a span containing the maximum value as
        //   its inner HTML
        Console.Slider = function (elem)
        {
            this.$document = $(document);
            this.sliderElem = elem.find('svg');
            this.inputElem = elem.find('input');
            this.anchorElem = elem.find('a');
            this.minValue = parseInt(elem.find('.minValueSpan')[0].innerHTML);
            this.maxValue = parseInt(elem.find('.maxValueSpan')[0].innerHTML);
            this.radius = parseInt(this.sliderElem.find('circle').attr('r'));
            this.sliderElem.on('mousedown.slider-elem', this.enableSliderMovement.bind(this));
            // Suppress following hyperlink on click
            this.anchorElem.on('click.anchor-elem', function (event)
            {
                event.preventDefault();
            });
        };
        Console.Slider.prototype =
        {
            sliderElem: undefined,
            inputElem: undefined,
            anchorElem: undefined,
            minValue: undefined,
            maxValue: undefined,
            radius: undefined,
            $document: undefined,

            enableSliderMovement: function (event)
            {
                // Left-click only
                if (event.which !== 1)
                {
                    return;
                }

                event.preventDefault();
                // Update circle location and input value based on mouse location
                this.updateTrackerElementAndInput(event.clientX);
                // Turn on mouse movement tracking, stop tracking if cursor leaves svg element
                this.$document.on('mousemove.slider-elem', this.sliderElementMovement.bind(this));
                this.$document.on('mouseup.slider-elem', this.disableSliderMovement.bind(this));
            },

            sliderElementMovement: function (event)
            {
                this.updateTrackerElementAndInput(event.clientX);
            },

            disableSliderMovement: function (event)
            {
                this.$document.off('mousemove.slider-elem');
            },

            updateTrackerElementAndInput: function (clientXCoordinate)
            {
                // Ensure xCoordinate to update center to keeps circle within the svg element
                var xCoordinate = this.normalizeTrackerXCoordinate(clientXCoordinate);
                // Update the center of the circle and the value of the input field
                this.sliderElem.find('circle').attr('cx', xCoordinate);
                this.inputElem.val(Math.round(this.scaleXCoordinate(xCoordinate)));
            },

            updateTrackerLocationFromInput: function ()
            {
                // User entered value into input field, first check that input is a number
                var inputValue = this.inputElem.val();
                if (inputValue && inputValue.length && Utils.isNumber(parseInt(inputValue)))
                {
                    // Round to the nearest integer and check that it is within the acceptable range
                    var inputInteger = Math.round(inputValue);
                    if (this.minValue <= inputInteger && inputInteger <= this.maxValue)
                    {
                        // Calculate center of circle on svg element and update
                        this.sliderElem.find('circle').attr('cx', this.descaleXCoordinate(inputInteger));
                    }
                }
            },

            normalizeTrackerXCoordinate: function (clientXCoordinate)
            {
                // Normalize the mouse x-coordinate to be within svg element, accounting for radial offset
                var sliderSvgElemRect = this.sliderElem[0].getBoundingClientRect();
                return Math.min(Math.max(clientXCoordinate, sliderSvgElemRect.left + this.radius), sliderSvgElemRect.right - this.radius) - sliderSvgElemRect.left;
            },

            scaleXCoordinate: function (xCoordinate)
            {
                // Convert mouse location to scale defined by min and max values with radial offset
                var sliderSvgElemRect = this.sliderElem[0].getBoundingClientRect();
                return this.minValue + ((xCoordinate - this.radius) / (sliderSvgElemRect.width - 2 * this.radius)) * (this.maxValue - this.minValue);
            },

            descaleXCoordinate: function (inputValue)
            {
                // Convert input value to svg offset
                var sliderSvgElemRect = this.sliderElem[0].getBoundingClientRect();
                return this.radius + ((inputValue - this.minValue) / (this.maxValue - this.minValue)) * (sliderSvgElemRect.width - 2 * this.radius);
            },

            getValue: function ()
            {
                return this.inputElem.val();
            },

            destroy: function ()
            {
                this.sliderElem.off('.slider-elem');
                this.$document.off('.slider-elem');
                this.anchorElem.off('.anchor-elem');
            }
        };
        /**
         * The list class. 
         * 
         * @mixes Console.asActionable
         * @param {!jQuery} elem - The root element of the list. 
         * @param {!Object} options - Options affecting the behavior of this list. 
         */
        Console.List = function (elem, options) 
        {
            var self = this;
            Console.UINode.call(this, elem);
            Console.asActionable.call(this);

            var defaults =
            {
                idAttrName: 'id',
                idName: undefined,
                selector: undefined,
                structure: undefined,
                body: undefined,
                autoAdd: false
            };
            this.settings = $.extend(defaults, options);

            this.idAttrName = this.settings.idAttrName;
            this.idName = this.settings.idName
                || $.camelCase(this.idAttrName.replace(/^data-/, ''));
            this.selector = this.settings.selector || ('[' + this.idAttrName + ']');
            this.body = this.settings.body
                || this.elem.is('table') && this.elem.children('tbody')
                || this.elem.is('ol, ul') && this.elem
                || this.elem;
            this.structure = this.settings.structure
                || this.body.is('tbody, ol, ul') && 'dense'
                || 'sparse';

            this.scroll = this.body.closest('.scroll');
            this.elem.addClass('list');

            var blankElem = this.findItems('.blank');
            this.template = blankElem.clone(true);

            // Set up primordial items
            this.items = {};
            this.findAll().each(function ()
            {
                var item = self.makeItem($(this));
                self.link(item);
            });

            this.blank = this.item(blankElem);

            if (this.settings.autoAdd)
            {
                this.autoAddHandler = this.settings.autoAddHandler
                    || (function (event)
                    {
                        if ($(this).val() !== '')
                        {
                            self.appendBlank();
                        }
                    });

                this.blank.elem.on(this.changeEvents, ':input[type!=checkbox]', this.autoAddHandler);
            }
        };

        Console.List.prototype =
        {
            /**
             * Options of this list. 
             * @type {!Object}
             */
            settings: undefined,

            /**
             * The DOM structure of the list. Either dense or sparse. 
             * @type {string}
             */
            structure: undefined,

            /**
             * The selector which filters the list items. 
             * @type {string}
             */
            selector: undefined,

            /**
             * The list items, indexed by their IDs. 
             * @type {Object.<string, ListItem>}
             */
            items: undefined,

            /**
             * The name of the ID property of list items. 
             * @type {string}
             */
            idName: undefined,

            /**
             * The name of the attribute representing the ID of list item elements. 
             * @type {string}
             */
            idAttrName: undefined,

            /**
             * The scrollable region containing the list, if any. 
             * @type {!jQuery}
             */
            scroll: undefined,

            /**
             * The body of the list. 
             * @type {!jQuery}
             */
            body: undefined,

            /**
             * The selected list item. 
             * @type {ListItem}
             */
            selectItem: undefined,

            /**
             * The ID of the list item currently selected, or the ID of an non-
             * existent list item to be selected. 
             * @type {?string}
             */
            selectId: undefined,

            /**
             * The pending list item. 
             * @type {ListItem}
             */
            pendItem: undefined,

            /**
             * The ID of the list item currently pending, or the ID of an non-existent 
             * list item to be pending. 
             * @type {?string}
             */
            pendId: undefined,

            /**
             * The blank list item. 
             * @type {ListItem}
             */
            blank: undefined,

            /**
             * The template from which new list items are cloned. 
             * @type {!jQuery}
             */
            template: undefined,

            destroy: function ()
            {
                this.elem.off('.list');

                for (var id in this.items)
                {
                    this.unlink(this.items[id]);
                }

                Console.UINode.prototype.destroy.call(this);
            },

            /**
             * Rebuids this list with the specified item. 
             * @elem {!jQuery} - The root element of the list. 
             */
            refreshWith: function (elem)
            {
                var scrollTop = this.scroll.scrollTop();
                this.destroy();

                this.elem.replaceChildrenWith(elem);
                this.constructor.call(this, this.elem, this.settings);
                this.scroll.scrollTop(scrollTop);

                this.pend(this.pendId);
                this.select(this.selectId);
            },

            /**
             * Finds DOM elements of items satisfying a selector. 
             * @param {string} selector - The filter
             * @returns {!jQuery} The elements
             */
            findItems: function (selector)
            {
                if (this.structure === 'dense')
                {
                    return this.body.children(selector);
                }
                else  // sparse
                {
                    return this.body.find(selector);
                }
            },

            /**
             * Finds DOM elements of all items in this list. 
             * @returns {!jQuery} The elements
             */
            findAll: function ()
            {
                if (this.structure === 'dense')
                {
                    return this.body.children();
                }
                else  // sparse
                {
                    return this.body.find(this.selector);
                }
            },

            /**
             * Returns the specified list item. 
             * @param {ListItem|jQuery|Event|string|undefined} arguments - The list 
             *   item, the element of the list item, an event whose target belongs to 
             *   the list item, or the id of the list item. 
             * @returns {ListItem} - The list item, or undefined if it does not exist
             */
            item: function ()
            {
                if (arguments[0] instanceof jQuery)
                {
                    var elem = arguments[0];
                    return this.items[elem.attr(this.idAttrName)];
                }
                else if (arguments[0] && arguments[0].target)
                {
                    var elem = $(arguments[0].target).closest(this.selector);
                    return this.items[elem.attr(this.idAttrName)];
                }
                else if (arguments[0] && arguments[0].elem)
                {
                    return arguments[0];
                }
                else
                {
                    return this.items[arguments[0]];
                }
            },

            /**
             * Sets the currently selected list item. 
             * @param {jQuery|Event|string|undefined} _item - The item to select
             * @returns {ListItem} - The newly selected item, if it exists
             */
            select: function (_item)
            {
                if (this.selectItem)
                {
                    this.selectItem.elem.removeClass('selected');
                }

                this.selectItem = this.item(_item);
                this.selectId =
                    typeof this.selectItem === 'object' && this.selectItem[this.idName]
                    || typeof _item === 'string' && _item
                    || undefined
                    ;

                if (this.selectItem)
                {
                    this.selectItem.elem.addClass('selected');
                }
                return this.selectItem;
            },

            /**
             * Sets the currently pending list item. 
             * @param {jQuery|Event|string|undefined} _item - The item to pend 
             * @returns {ListItem} - The newly pended item, if it exists
             */
            pend: function (_item)
            {
                if (this.pendItem)
                {
                    this.pendItem.elem.removeClass('pending');
                }

                this.pendItem = this.item(_item);
                this.pendId =
                    typeof this.pendItem === 'object' && this.pendItem[this.idName]
                    || typeof _item === 'string' && _item
                    || undefined
                    ;

                if (this.pendItem)
                {
                    this.pendItem.elem.addClass('pending');
                }
                return this.pendItem;
            },

            /**
             * Scrolls the view containing the list so that the specified item is not 
             * occluded. 
             * @param {jQuery|Event|string} item - The list element to center. 
             */
            scrollTo: function (_item)
            {
                this.center(_item, true);
            },

            /**
             * Scrolls the view containing the list so that the selected item is not 
             * occluded. 
             */
            normalize: function ()
            {
                if (!this.selectItem) { return; }

                this.center(this.selectItem, true);
            },

            /**
             * Scrolls the view containing the list so that the specified item is as 
             * close to the center of the view as possible. 
             * @param {jQuery|Event|string} item - The list element to center. 
             * @param {bool=false} ifOccluded - Centers the list item only if part of 
             *   it is outside the scroll viewport. 
             */
            center: function (_item, ifOccluded)
            {
                var item = this.item(_item);
                if (!item) { return; }

                var itemTop = item.elem.position().top;
                var itemHeight = item.elem.height();
                var viewHeight = this.scroll.height();

                if (!ifOccluded
                    || itemTop < 0
                    || viewHeight < itemTop + itemHeight
                )
                {
                    var delta = (itemTop + itemHeight / 2) - (viewHeight / 2);
                    this.scroll.scrollTop(this.scroll.scrollTop() + delta);
                }
            },

            /**
             * Adds the specified list item to the end of the list. 
             * @param {!ListItem|jQuery} item - The list item to add. 
             * @returns {!ListItem} The item that was added
             */
            add: function (_item)
            {
                var item = this.makeItem(_item);
                this.body.append(item.elem);
                this.link(item);
                this.onChange();
                return item;
            },

            /**
             * Removes the specified list item. 
             * @param {jQuery|Event|string} item - The list item to remove, an event 
             *   whose target belongs to the list item, or the id of the list item. 
             * @returns {!ListItem} The removed list item. 
             */
            remove: function (_item)
            {
                var item = this.item(_item);
                if (!item) { throw new Error('No such list item'); }

                this.unlink(item);
                item.elem.remove();
                this.onChange();
                return item;
            },

            /**
             * Links the specified list item to this list. 
             * @param {!ListItem} item - The list item
             */
            link: function (item)
            {
                var app = Console.instance;

                // Ensure both the item and the DOM element have the same ID
                var id = item[this.idName]
                    || item.elem.attr(this.idAttrName)
                    || app.autoId()
                    ;
                item[this.idName] = id;
                item.elem.attr(this.idAttrName, id);

                this.constructItem(item);
                this.items[id] = item;
            },

            /**
             * Unlinks the specified list item to this list. 
             * @param {!ListItem} item - The list item
             */
            unlink: function (item)
            {
                var id = item[this.idName];
                delete this.items[id];
                this.destroyItem(item);
            },

            makeItem: function (_item)
            {
                if (_item instanceof jQuery)
                {
                    return { elem: _item.first() };
                }
                else
                {
                    return _item;
                }
            },

            /**
             * Constructs a list item. This default implementation does nothing. 
             * @param {!ListItem} - The list item. 
             */
            constructItem: function (item) { },

            /**
             * Destroys a list item. This default implementation does nothing. 
             * @param {!ListItem} - The list item. 
             */
            destroyItem: function (item) { },


            changeEvents: 'propertychange.list keyup.list input.list paste.list change.list',

            /**
             * Adds a new list item to the end of the list. The list item is created by 
             * cloning the list item template. 
             * @returns {!jQuery} The new list item
             */
            appendBlank: function ()
            {
                // de-blank the old blank - "blank-binary" was added later, so we only do anything with that if it exists to preserve
                this.blank.elem.removeClass('blank');

                var addBlankBinary = false;
                if (this.blank.elem.hasClass('blank-binary'))
                {
                    addBlankBinary = true;
                    this.blank.elem.removeClass('blank-binary');
                }

                if (this.settings.autoAdd)
                {
                    this.blank.elem.off(this.changeEvents, ':input[type!=checkbox]');
                }

                // add new blank
                this.blank = this.createBlank();
                this.blank.elem.addClass('blank');

                if (addBlankBinary)
                {
                    this.blank.elem.addClass('blank-binary');
                }

                if (this.settings.autoAdd)
                {
                    this.blank.elem.on(this.changeEvents, ':input[type!=checkbox]', this.autoAddHandler);
                }

                this.add(this.blank);

                // automatically scroll to the new blank
                this.scrollTo(this.blank);

                return this.blank;
            },

            /**
             * Creates a new list item by cloning the list item template. 
             * @returns {!ListItem} The new list item
             */
            createBlank: function ()
            {
                return {
                    elem: this.template.clone(true)
                };
            },

            /**
             * Called when the collection of list items change. 
             */
            onChange: function () { }
        };
        Utils.inherit(Console.List, Console.UINode);

        /**
         * A stylized vertical scrollbar. 
         * @param {!jQuery} elem - The root element of the scrollbar. 
         * @param {!jQuery} view - The scrollable view which this scrollbar controls. 
         */
        Console.Scrollbar = function (elem, view)
        {
            var self = this;
            Console.UINode.call(this, elem);
            this.view = view;

            this.elem.addClass('scrollbar');

            this.track = $(document.createElement('div'))
                .addClass('scrollbar-track')
                .appendTo(this.elem);

            this.thumb = $(document.createElement('div'))
                .addClass('scrollbar-thumb')
                .appendTo(this.track);

            $(document.createElement('div'))
                .addClass('scrollbar-thumb-display')
                .appendTo(this.thumb);

            this.update();

            // Update scrollbar when view scrolls
            this.view.on('scroll.console-scrollbar', this.update.bind(this));

            // Update scrollbar and view upon mouse wheel scroll
            this.view.on('mousewheel.console-scrollbar',
                function (event, delta, deltaX, deltaY)
                {
                    event.preventDefault();
                    self.view.scrollTop(self.view.scrollTop() - deltaY * 90);
                    self.update();
                });

            // Update scrollbar and view upon dragging the thumb
            this.thumb.on('mousedown.console-scrollbar',
                function (event)
                {
                    event.preventDefault();
                    var y = event.clientY;
                    var scrollTop = self.view.scrollTop();
                    self.thumb.toggleClass('active', true);

                    var $document = $(document);
                    $document.on('mousemove.console-scrollbar',
                        function (event)
                        {
                            var scrollHeight = self.view[0].scrollHeight;
                            var trackHeight = self.track.height();

                            self.view.scrollTop(scrollTop + (event.clientY - y) * scrollHeight / trackHeight);
                            self.update();
                        });

                    $document.on('mouseup.console-scrollbar',
                        function (event)
                        {
                            $document.off('mousemove.console-scrollbar');
                            $document.off('mouseup.console-scrollbar');
                            self.thumb.removeClass('active');
                        });
                });

            // Update scrollbar and view upon clicking the track
            this.track.on('click.console-scrollbar', function (event)
            {
                if (event.target === self.track[0])
                {
                    if (event.offsetY < self.thumb.position().top)
                    {
                        self.view.scrollTop(self.view.scrollTop() - self.view.height());
                        self.update();
                    }
                    else if (self.thumb.position().top + self.thumb.height() < event.offsetY)
                    {
                        self.view.scrollTop(self.view.scrollTop() + self.view.height());
                        self.update();
                    }
                }
            });
        };

        Console.Scrollbar.prototype =
        {
            destroy: function ()
            {
                this.view.off('.console-scrollbar');
                this.track.off('click.console-scrollbar');
                this.thumb.off('mousedown.console-scrollbar');
                this.thumb.remove();
                Console.UINode.prototype.destroy.call(this);
            },

            /**
             * Updates the visual properties of this scrollbar from the view it 
             * controls. 
             */
            update: function ()
            {
                var scrollTop = this.view.scrollTop();
                var scrollHeight = this.view[0].scrollHeight;
                var viewHeight = this.view.height();
                var trackHeight = this.track.height();

                if (trackHeight === 0)
                {
                    trackHeight = viewHeight;
                }

                var visible = scrollHeight > viewHeight;
                this.elem.toggle(visible);
                this.view.toggleClass('has-scrollbar', visible);

                if (visible)
                {
                    this.thumb.height(viewHeight * trackHeight / scrollHeight);
                    this.thumb.css('top', (scrollTop * trackHeight / scrollHeight) + 'px');
                }
            }
        };
        Utils.inherit(Console.Scrollbar, Console.UINode);

        Console.Placeholder = function (elem, placeholder, initializeEmpty)
        {
            Console.UINode.call(this, elem);
            var self = this;

            this.placeholder = placeholder;
            this.initializeEmpty = initializeEmpty || false;
            this.initialize();
        };

        Console.Placeholder.prototype =
        {
            placeholder: undefined,

            escapeChar: '\x1B',

            initializeEmpty: false,

            getValue: function ()
            {
                var searchString = this.elem.val();
                if (searchString.indexOf(this.escapeChar) === 0)
                {
                    searchString = '';
                }
                return searchString;
            },

            clear: function (refocus)
            {
                if (Utils.Browser.chrome() || Utils.Browser.firefox())
                {
                    this.elem.val('');
                    return;
                }

                this.elem.val(this.escapeChar + this.placeholder);
                this.elem.toggleClass('on-placeholder', true);
                if (refocus === true)
                {
                    var focusElem = this.elem[0];
                    if (focusElem.createTextRange)
                    {
                        var range = focusElem.createTextRange();
                        range.move('character', 0);
                        range.select();
                    }
                    else if (focusElem.selectionStart || focusElem.selectionStart === 0)
                    {
                        focusElem.setSelectionRange(0, 0);
                    }
                }
            },

            onEnter: function () { },

            initialize: function ()
            {
                var self = this;

                // bind events that work for all browsers
                this.elem.on('keydown.placeholder',
                    function (event)
                    {
                        var searchString = self.elem.val();
                        var uninitialized = searchString.indexOf(self.escapeChar) === 0;
                        if (uninitialized && (event.which === 8 || event.which === 46)) // If user presses Backspace or Delete
                        {
                            event.preventDefault();
                        }
                        else if (!uninitialized && event.which === 13) // If user presses Enter
                        {
                            self.onEnter();
                        }
                    });

                // Browser specific functionality
                if (Utils.Browser.chrome() || Utils.Browser.firefox())
                {
                    // initialize field
                    if (self.initializeEmpty)
                    {
                        self.elem.val('');
                    }

                    this.elem.attr('placeholder', this.placeholder);
                }
                else
                {
                    // IE specific code
                    // initialize field
                    if (self.initializeEmpty)
                    {
                        self.elem.val(self.escapeChar + self.placeholder);
                        self.elem.toggleClass('on-placeholder', true);
                    }

                    // bind IE specific events
                    this.elem.on('keypress.placeholder',
                        function (event)
                        {
                            var searchString = self.elem.val();
                            var uninitialized = searchString.indexOf(self.escapeChar) === 0;
                            if (uninitialized && event.charCode && String.fromCharCode(event.charCode))
                            {
                                self.elem.val('');
                                self.elem.removeClass('on-placeholder');
                            }
                        });
                    this.elem.on('beforepaste.placeholder',
                        function (event)
                        {
                            var searchString = self.elem.val();
                            var uninitialized = searchString.indexOf(self.escapeChar) === 0;
                            if (uninitialized && window.clipboardData && window.clipboardData.getData && window.clipboardData.getData('text') && window.clipboardData.getData('text') !== '')
                            {
                                self.elem.val('');
                                self.elem.removeClass('on-placeholder');
                            }
                        });
                    this.elem.on('mousedown.placeholder',
                        function (event)
                        {
                            var searchString = self.elem.val();
                            if (searchString.indexOf(self.escapeChar) === 0)
                            {
                                event.preventDefault();
                            }
                        });
                    this.elem.on('focus.placeholder, click.placeholder',
                        function (event)
                        {
                            var searchString = self.elem.val();
                            if (!searchString || searchString.indexOf(self.escapeChar) === 0)
                            {
                                event.preventDefault();
                                self.clear(true);
                            }
                        });
                    this.elem.on('blur.placeholder',
                        function (event)
                        {
                            var searchString = self.elem.val();
                            if (!searchString)
                            {
                                self.clear();
                            }
                        });

                    var currentValue = this.elem.val();
                    if (!currentValue)
                    {
                        this.clear();
                    }
                    else if (currentValue.indexOf(this.escapeChar) !== 0)
                    {
                        this.elem.removeClass('on-placeholder');
                    }
                }
            },

            destroy: function ()
            {
                this.elem.off('.placeholder');
                this.elem.removeClass('on-placeholder');
                Console.UINode.prototype.destroy.call(this);
            }
        };
        Utils.inherit(Console.Placeholder, Console.UINode);

        // A control to manage multiple select lists
        // @param elem {jquery} - root element of the list
        // @param options {object} - contains parameters for the list constructor
        Console.DistinctMultiselect = function (elem, options)
        {
            Console.List.call(this, elem, options);
            this.allValues = {};
            this.sortedValues = {};
            this.categories = {};
            this.sorted = {};
            this.initItems();
        };

        Console.DistinctMultiselect.prototype =
        {
            previousValue: undefined,
            linkedMultiselect: undefined,

            updateOptions: function ()
            {
                var selected = selected || {};
                var filtered = {};
                var included = {};
                var selects = this.getDropdowns();
                var self = this;
                var changed = {};
                var val;

                // Gather the selected values
                selects.each(
                    function ()
                    {
                        val = $(this).val();
                        if (val)
                        {
                            selected[val] = true;
                        }
                    });

                if (typeof this.linkedMultiselect !== 'undefined')
                {
                    this.linkedMultiselect.getDropdowns().each(
                        function ()
                        {
                            val = $(this).val();
                            if (val)
                            {
                                selected[val] = true;
                                if (this.categoryFilter && categories[val] && this.categoryFilter === categories[val])
                                {
                                    filtered[val] = true;
                                }
                            }
                        });
                }

                // Remove the selected values from all other select boxes
                for (val in selected)
                {
                    selects.each(
                        function ()
                        {
                            var $this = $(this);
                            var valthis = $this.val();
                            if (val && (valthis !== val)) // If the current value in selected is the selected value for this dropdown, don't do anything.
                            {
                                self.removeOption($this, val);
                                changed[$this.uniqueID] = true; // Mark this select list as altered afterward.
                            }
                        });
                }

                // Identify all values to be included
                for (val in self.allValues)
                {
                    if (this.categoryFilter && this.categories[val] && this.categoryFilter !== this.categories[val])
                    {
                        filtered[val] = true;
                    }
                    else if (selected[val] === undefined)
                    {
                        included[val] = true;
                    }
                }

                // Remove the filtered values from all select boxes in which they are not selected
                for (val in filtered)
                {
                    selects.each(
                        function ()
                        {
                            var $this = $(this);
                            var valthis = $this.val();
                            if (val && (valthis !== val)) // If the current value in selected is the selected value for this dropdown, don't do anything.
                            {
                                self.removeOption($this, val);
                                changed[$this.uniqueID] = true; // Mark this select list as altered afterward.
                            }
                        });
                }


                // Restore included values
                selects.each(
                    function ()
                    {
                        var $this = $(this);
                        var uniqueID = $this[0].uniqueID;
                        var inSelect = {};
                        var opts = $this.find('option[value]');
                        opts.each(
                            function () // Figure out which options are already in the dropdown
                            {
                                var opt = $(this);
                                var val = opt.attr('value');
                                if (val)
                                {
                                    inSelect[val] = true;
                                }
                            });
                        for (var val in included) // Put back the missing options
                        {
                            if (!inSelect[val])
                            {
                                var opt = document.createElement('option');
                                opt.text = self.allValues[val];
                                opt.value = val;
                                if (self.sortedValues[val] !== undefined)
                                {
                                    opt.setAttribute('data-sort', self.sortedValues[val]);
                                }
                                if (self.categories[val] !== undefined)
                                {
                                    opt.setAttribute('category', self.categories[val]);
                                }
                                this.add(opt);
                                changed[uniqueID] = true;
                            }
                        }
                        if (changed[uniqueID])
                        {
                            self.sortItems(uniqueID);
                        }
                    });
                this.toggleDropdownEnabled();
            },

            onFocus: function (event)
            {
                var $selector = $(event.target);
                this.previousValue = $selector.val() || '';
                var uniqueID = $selector[0].uniqueID;
                if (!this.sorted[uniqueID])
                {
                    this.sortItems(uniqueID);
                }
            },

            onValueChange: function (event)
            {
                var target = $(event.target);
                var val = target.val();
                if (this.settings.autoAdd)
                {
                    if (val)
                    {
                        target.find('option[value=""]').remove();
                    }
                }
                this.onRemoveValue(this.previousValue, true);
                this.onAddValue(val, true);
                this.previousValue = val;
            },

            // handles a selection of a value by removing it from the options list of each select
            onAddValue: function (val, propagate)
            {
                this.removeValueOptions(val);
                // call onAddValue for linked Console.DistinctMultiselect object
                if (propagate && typeof this.linkedMultiselect !== 'undefined')
                {
                    this.linkedMultiselect.onAddValue(val, false);
                }
            },

            // handles the removal of a selection by adding it back to the options list of each select
            onRemoveValue: function (val, propagate)
            {
                if (val !== '' && (!this.categoryFilter || !this.categories[val] || this.categoryFilter === this.categories[val]))
                {
                    this.addValueOptions(val);
                    // call onRemoveValue for linked Console.DistinctMultiselect object
                    if (propagate && typeof this.linkedMultiselect !== 'undefined')
                    {
                        this.linkedMultiselect.onRemoveValue(val, false);
                    }
                }
            },

            // add and remove values as necessary to display only one category
            filterCategory: function (category, propogate)
            {
                this.categoryFilter = category;
                this.updateOptions();

                // call filterCategory for linked Console.DistinctMultiselect object
                if (propogate && typeof this.linkedMultiselect !== 'undefined')
                {
                    this.linkedMultiselect.filterCategory(category, false);
                }
            },

            // Add a value to the options list of each select
            addValueOptions: function (val)
            {
                var self = this;
                this.getDropdowns().each(
                    function ()
                    {
                        self.addOption($(this), val);
                    });
            },

            // Remove a value from the options list of each select
            removeValueOptions: function (val)
            {
                var self = this;
                this.getDropdowns().each(
                    function ()
                    {
                        self.removeOption($(this), val);
                    });
            },

            addOption: function ($selector, value)
            {
                if (value)
                {
                    // add the option element if it isn't found in the select options
                    if (!this.isOptionExist($selector, value))
                    {
                        var opt = document.createElement('option');
                        opt.text = this.allValues[value];
                        opt.value = value;
                        var uniqueID = $selector[0].uniqueID;
                        // Set the option element's data-sort attribute if available
                        if (this.sortedValues[value] !== undefined)
                        {
                            opt.setAttribute('data-sort', this.sortedValues[value]);
                        }
                        if (this.categories[value] !== undefined)
                        {
                            opt.setAttribute('category', this.categories[value]);
                        }
                        $selector[0].add(opt);
                        $selector.prop('disabled', false);
                        this.sorted[uniqueID] = false;
                    }
                }
            },

            isOptionExist: function ($selector, value)
            {
                var exist = false;
                if (value)
                {
                    $selector.find('option').each(function ()
                    {
                        var $this = $(this);
                        if ($this.val() === value)
                        {
                            exist = true;
                            return exist;
                        }
                    });
                }
                return exist;
            },

            removeOption: function ($selector, value)
            {
                var valthis = $selector.val();

                if (value && (valthis !== value)) // If the current value in selected is the selected value for this dropdown, don't do anything
                {
                    $selector.find('option').each(function ()
                    {
                        var $this = $(this);
                        if ($this.val() === value)
                        {
                            $this.remove();
                        }
                    });
                    if ($selector.find('option[value]').length === 1 && $selector.find('option[value]')[0].value === '')
                    {
                        $selector.prop('disabled', true);
                    }
                }
            },

            removeOptions: function ($selector, options)
            {
                $selector.find('option').each(function ()
                {
                    var $this = $(this);
                    if (options.indexOf($this.val()) >= 0)
                    {
                        $this.remove();
                    }
                });
                if ($selector.find('option[value]').length === 1 && $selector.find('option[value]')[0].value === '')
                {
                    $selector.prop('disabled', true);
                }
            },

            filterToCategory: function ($selector, category)
            {
                $selector.find('option').each(function ()
                {
                    $this = $(this);
                    var thisCategory = $this.attr('category');
                    if (thisCategory && thisCategory !== category)
                    {
                        $this.remove();
                    }
                });
                if ($selector.find('option[value]').length === 1 && $selector.find('option[value]')[0].value === '')
                {
                    $selector.prop('disabled', true);
                }
            },

            initItems: function ()
            {
                var self = this;
                var triggerTypes = Utils.sformat.call('mousedown{0} focus{0}', this.eventSuffix);
                this.getDropdowns().bind(triggerTypes, this.onFocus.bind(this));
                this.getDropdowns().bind('change' + this.eventSuffix, this.onValueChange.bind(this));

                // gather option values
                var opts = this.getDropdowns().find('option[value]');
                opts.each(
                    function ()
                    {
                        var option = $(this);
                        var val = option.attr('value');
                        if (val)
                        {
                            self.allValues[val] = option.text();
                        }
                        var index = option.attr('data-sort');
                        if (index !== undefined)
                        {
                            self.sortedValues[val] = +index;
                        }
                        var category = option.attr('category');
                        if (category !== undefined)
                        {
                            self.categories[val] = category;
                        }
                    });

                this.getDropdowns().each(
                    function ()
                    {
                        var selector = $(this);
                        // If the list is autoAdd mode, remove the default option from the dropdown if non-default option is selected
                        if (self.settings.autoAdd)
                        {
                            if (selector.val())
                            {
                                selector.find('option[value=""]').remove();
                            }
                        }
                    });
                this.updateOptions();
            },

            handleSelectChange: function ()
            {
                Console.DistinctMultiselect.prototype.updateOptions.call(this);
            },


            toggleDropdownEnabled: function (disabled)
            {
                if (typeof disabled === 'undefined')
                {
                    disabled = false;
                }

                // If disabled is set to true, overwrite existing behavior and disable all multi-select dropdown fields.
                // Otherwise, disable them only if there is no entity to select
                this.getDropdowns().each(
                    function ()
                    {
                        var select = $(this);
                        var opts = select.find('option[value]');
                        select.prop('disabled', (opts.length === 1 && opts[0].value === '') || disabled);
                    });
                // If disabled is set, hide X button
                if (disabled)
                {
                    this.elem.find('.remove-item').hide();
                }
                else
                {
                    this.elem.find('.remove-item').show();
                }
            },

            getDropdowns: function ()
            {
                return this.elem.find('select');
            },

            destroy: function ()
            {
                var self = this;
                this.getDropdowns().each(
                    function ()
                    {
                        $(this).off(self.eventSuffix);
                    });
                Console.List.prototype.destroy.call(this);
            },

            add: function (_item)
            {
                var item = Console.List.prototype.add.call(this, _item);
                var $selector = item.elem.find('select');
                var triggerTypes = Utils.sformat.call('mousedown{0} focus{0}', this.eventSuffix);
                $selector.bind(triggerTypes, this.onFocus.bind(this));
                $selector.bind('change' + this.eventSuffix, this.onValueChange.bind(this));

                var values = [];
                this.collectSelectedValues(values);

                // remove options and disable if necessary
                this.removeOptions($selector, values);
                if (this.categoryFilter)
                {
                    this.filterToCategory($selector, this.categoryFilter);
                }
                if ($selector.find('option[value]').length === 1 && $selector.find('option[value]')[0].value === '')
                {
                    $selector.prop('disabled', true);
                }

                return item;
            },

            remove: function (_item)
            {
                var item = Console.List.prototype.remove.call(this, _item);
                var val = item.elem.find('select').val();
                this.onRemoveValue(val, true);
                item.elem.off(this.eventSuffix);

                return item;
            },

            sortItems: function (uniqueID)
            {
                var self = this;
                var selects = this.getDropdowns();
                selects.each(
                    function ()
                    {
                        if (!uniqueID || this.uniqueID === uniqueID)
                        {
                            var $this = $(this);
                            var val = $this.val();
                            var opts = $this.find('option[value]');
                            var optCache = {};
                            opts = opts.remove().sort(
                                function (a, b)
                                {
                                    if (!optCache[a.uniqueID])
                                    {
                                        optCache[a.uniqueID] = { value: a.value, sortIndex: a.getAttribute('data-sort'), text: a.text };
                                        if (optCache[a.uniqueID].sortIndex === null)
                                        {
                                            optCache[a.uniqueID].sortIndex = -1;
                                        }
                                        else
                                        {
                                            optCache[a.uniqueID].sortIndex = +optCache[a.uniqueID].sortIndex;
                                        }
                                    }
                                    if (!optCache[b.uniqueID])
                                    {
                                        optCache[b.uniqueID] = { value: b.value, sortIndex: b.getAttribute('data-sort'), text: b.text };
                                        if (optCache[b.uniqueID].sortIndex === null)
                                        {
                                            optCache[b.uniqueID].sortIndex = -1;
                                        }
                                        else
                                        {
                                            optCache[b.uniqueID].sortIndex = +optCache[b.uniqueID].sortIndex;
                                        }
                                    }
                                    if (!optCache[a.uniqueID].value)
                                    {
                                        return -1;
                                    }
                                    if (!optCache[b.uniqueID].value)
                                    {
                                        return 1;
                                    }
                                    if (optCache[a.uniqueID].sortIndex !== null && optCache[b.uniqueID].sortIndex !== null)
                                    {
                                        if (optCache[a.uniqueID].sortIndex > optCache[b.uniqueID].sortIndex)
                                        {
                                            return 1;
                                        }
                                        else if (optCache[a.uniqueID].sortIndex < optCache[b.uniqueID].sortIndex)
                                        {
                                            return -1;
                                        }
                                    }
                                    if (optCache[a.uniqueID].text > optCache[b.uniqueID].text)
                                    {
                                        return 1;
                                    }
                                    else if (optCache[b.uniqueID].text > optCache[a.uniqueID].text)
                                    {
                                        return -1;
                                    }
                                    else
                                    {
                                        return 0;
                                    }
                                });
                            $this.append(opts);
                            $this.val(val);
                            self.sorted[this.uniqueID] = true;
                            if (uniqueID)
                            {
                                return false;
                            }
                        }
                    });
            },

            collectOptions: function (options)
            {
                var optSelector, val;
                this.getDropdowns().each(
                    function ()
                    {
                        val = $(this).val();
                        if (val)
                        {
                            optSelector = Utils.sformat.call('option[value="{0}"]', val);
                            if (options.indexOf(optSelector) === -1)
                            {
                                options.push(optSelector);
                            }
                        }
                    });
            },

            collectSelectedValues: function (options)
            {
                var val;
                this.getDropdowns().each(
                    function ()
                    {
                        val = $(this).val();
                        if (val)
                        {
                            if (options.indexOf(val) === -1)
                            {
                                options.push(val);
                            }
                        }
                    });
            },

            joinWith: function (other)
            {
                this.linkedMultiselect = other;
                other.linkedMultiselect = this;
                this.updateOptions();
                other.updateOptions();
            },

            eventSuffix: '.dm',
        };
        Utils.inherit(Console.DistinctMultiselect, Console.List);

        // A control to manage mapped multiple select lists
        // @param elem {jquery} - root element of the list
        // @param options {object} - contains parameters for the list constructor
        Console.MappedDistinctMultiselect = function (elem, options)
        {
            this.keySelector = options.keySelector || 'select.key';
            this.valueSelector = options.valueSelector || 'select.value';
            this.allKeys = {}; // of form value => option text
            this.allValues = {}; // of form value => option text
            this.sortedValues = {}; // of form dropdown value => sort index
            this.sortedKeys = {}; // of form dropdown key value => sort index
            Console.DistinctMultiselect.call(this, elem, options);
        };
        Console.MappedDistinctMultiselect.prototype =
        {

            initItems: function ()
            {
                var self = this;
                self.allKeys = {};
                self.allValues = {};
                self.sortedValues = {};
                self.sortedKeys = {};
                var triggerTypes = Utils.sformat.call('mousedown focus{0}', this.eventSuffix);

                var $this = this.findAll().first();
                var $keySelector = $this.find(self.keySelector);
                var $valueSelector = $this.find(self.valueSelector);

                // gather option values
                $keySelector.each(
                    function ()
                    {
                        var select = $(this);
                        var opts = select.find('option[value]');
                        opts.each(
                            function ()
                            {
                                var opt = $(this);
                                var val = opt.attr('value');
                                if (val)
                                {
                                    self.allKeys[val] = opt.text();
                                    var index = opt.attr('data-sort');
                                    if (index !== undefined)
                                    {
                                        self.sortedKeys[val] = +index;
                                    }
                                }
                            });
                    });

                $valueSelector.each(
                    function ()
                    {
                        var select = $(this);
                        var opts = select.find('option[value]');
                        opts.each(
                            function ()
                            {
                                var opt = $(this);
                                var val = opt.attr('value');
                                if (val)
                                {
                                    self.allValues[val] = opt.text();
                                    var index = opt.attr('data-sort');
                                    if (index !== undefined)
                                    {
                                        self.sortedValues[val] = +index;
                                    }
                                }
                            });
                    });

                this.findAll().each(
                    function ()
                    {
                        $this = $(this);
                        $selectors = $this.find('select');
                        $valueSelector = $this.find(self.valueSelector);
                        $selectors.bind(triggerTypes, self.onFocus.bind(self));
                        $selectors.bind('change' + self.eventSuffix, self.onValueChange.bind(self));

                        if (self.settings.autoAdd)
                        {
                            if ($valueSelector.val())
                            {
                                $valueSelector.find('option[value=""]').remove();
                            }
                        }
                    });
                this.updateOptions();
            },

            onValueChange: function (event)
            {
                var self = this;
                var $thisSelector = $(event.target);
                var filter = $thisSelector.is(this.keySelector) ? this.keySelector : this.valueSelector;
                var siblingFilter = filter === this.keySelector ? this.valueSelector : this.keySelector;
                var newValue = $thisSelector.val();
                var previousValue = this.previousValue;
                var $thisSiblingSelector = $thisSelector.parent().find(siblingFilter);
                var thisSiblingValue = $thisSiblingSelector.val();
                // remove and replace options
                var $root, $selector, $siblingSelector, value, siblingValue, ix;
                var optsToRemove = [];
                var optsToAdd = [];
                this.findAll().each(
                    function ()
                    {
                        $root = $(this);
                        $selector = $root.find(filter);
                        value = $selector.val();
                        $siblingSelector = $root.find(siblingFilter);
                        siblingValue = $siblingSelector.val();

                        if (siblingValue === thisSiblingValue)
                        {
                            self.addOption($selector, previousValue);
                            self.removeOption($selector, newValue);
                        }

                        if (value === newValue)
                        {
                            if (siblingValue)
                            {
                                optsToRemove.push(siblingValue);
                                // remove from options to add
                                ix = optsToAdd.indexOf(siblingValue);
                                if (ix !== -1)
                                {
                                    optsToAdd.splice(ix, 1);
                                }
                                self.removeOption($thisSiblingSelector, siblingValue);
                            }
                            self.removeOption($siblingSelector, thisSiblingValue);
                        }
                        else if (value === previousValue)
                        {
                            if (siblingValue)
                            {
                                ix = optsToRemove.indexOf(siblingValue);
                                // add if not contained in removal list
                                if (ix === -1)
                                {
                                    optsToAdd.push(siblingValue);
                                }
                            }
                            self.addOption($siblingSelector, thisSiblingValue);
                        }
                    });

                var i;
                for (i = 0; i < optsToAdd.length; i++)
                {
                    this.addOption($thisSiblingSelector, optsToAdd[i]);
                }

                var options = $thisSiblingSelector.find('option[value]');
                $thisSiblingSelector.prop('disabled', options.length === 1 && options[0].value === '');

                this.sorted[$thisSiblingSelector[0].uniqueID] &= optsToAdd.length === 0;
                this.previousValue = newValue;
            },

            addOption: function ($selector, value)
            {
                if (value)
                {
                    var allOptions = $selector.is(this.keySelector) ? this.allKeys : this.allValues;
                    var sortedOptions = $selector.is(this.keySelector) ? this.sortedKeys : this.sortedValues;
                    var optSelector = Utils.sformat.call('option[value="{0}"]', value);
                    // add the option element if it isn't found in the select options
                    if ($selector.find(optSelector).length === 0)
                    {
                        var opt = document.createElement('option');
                        opt.text = allOptions[value];
                        opt.value = value;
                        var uniqueID = $selector[0].uniqueID;
                        // Set the option element's data-sort attribute if available
                        if (sortedOptions[value] !== undefined)
                        {
                            opt.setAttribute('data-sort', sortedOptions[value]);
                        }
                        $selector[0].add(opt);
                        $selector.prop('disabled', false);
                        this.sorted[uniqueID] = false;
                    }
                }
            },

            updateOptions: function ()
            {
                var self = this;
                var selected = {}; // of form key => value => true
                var selectedReverse = {}; // of form value => key => true
                var allElements = this.findAll();

                // Gather all selections
                allElements.each(
                    function ()
                    {
                        var $root = $(this);
                        var $key = $root.find(self.keySelector);
                        var $value = $root.find(self.valueSelector);

                        var selectedKey = $key.val();
                        var selectedValue = $value.val();

                        if (selectedKey && selectedValue)
                        {
                            if (!selected[selectedKey])
                            {
                                selected[selectedKey] = {};
                            }
                            if (!selectedReverse[selectedValue])
                            {
                                selectedReverse[selectedValue] = {};
                            }
                            selected[selectedKey][selectedValue] = true;
                            selectedReverse[selectedValue][selectedKey] = true;
                        }
                    });

                allElements.each(
                    function ()
                    {
                        var $root = $(this);
                        var $key = $root.find(self.keySelector);
                        var $value = $root.find(self.valueSelector);
                        var selectedKey = $key.val();
                        var selectedValue = $value.val();
                        var optionSelector = 'option[value!=""]';
                        var option;

                        if (selectedKey)
                        {
                            var values = Utils.Algorithms.setMinus(self.allValues, selected[selectedKey]);
                            if (selectedValue)
                            {
                                values[selectedValue] = true;
                            }
                            $value.find(optionSelector).remove();
                            for (var val in values)
                            {
                                option = document.createElement('option');
                                option.text = self.allValues[val];
                                option.value = val;
                                if (self.sortedValues[val] !== undefined)
                                {
                                    option.setAttribute('data-sort', self.sortedValues[val]);
                                }
                                $value[0].add(option);
                            }
                            $value.val(selectedValue);
                        }

                        if (selectedValue)
                        {
                            var keys = Utils.Algorithms.setMinus(self.allKeys, selectedReverse[selectedValue]);
                            if (selectedKey)
                            {
                                keys[selectedKey] = true;
                            }
                            $key.find(optionSelector).remove();
                            for (var key in keys)
                            {
                                option = document.createElement('option');
                                option.text = self.allKeys[key];
                                option.value = key;
                                if (self.sortedKeys[key] !== undefined)
                                {
                                    option.setAttribute('data-sort', self.sortedKeys[key]);
                                }
                                $key[0].add(option);
                            }
                            $key.val(selectedKey);
                        }
                    });
            },

            handleSelectChange: function (self)
            {
                Console.MappedDistinctMultiselect.prototype.updateOptions.call(self);
            },

            toggleDropdownEnabled: function ()
            {
                var self = this;
                this.findAll().each(
                    function ()
                    {
                        var $root = $(this);
                        var $key = $root.find(self.keySelector);
                        var $value = $root.find(self.valueSelector);
                        var keyOptions = $key.find('option[value!=""]');
                        var valueOptions = $value.find('option[value!=""]');

                        var disableDropdowns = (keyOptions.length * valueOptions.length) === 0;
                        $key.attr('disabled', disableDropdowns);
                        $value.attr('disabled', disableDropdowns);
                    });
            },

            add: function (_item)
            {
                var item = Console.List.prototype.add.call(this, _item);
                var $selectors = item.elem.find('select');
                var $valueSelector = item.elem.find(this.valueSelector);
                var triggerTypes = Utils.sformat.call('mousedown focus{0}', this.eventSuffix);
                $selectors.bind(triggerTypes, this.onFocus.bind(this));
                $selectors.bind('change' + this.eventSuffix, this.onValueChange.bind(this));

                var keyValue = item.elem.find(this.keySelector).val();
                var options = [];
                this.collectOptions(options, keyValue);

                // remove options and disable if necessary
                var opts = $valueSelector.find(options.join(', '));
                opts.remove();
                opts = $valueSelector.find('option[value]');
                if (opts.length === 1 && opts[0].value === '')
                {
                    $valueSelector.prop('disabled', true);
                }
            },

            remove: function (_item)
            {
                var self = this;
                var item = Console.List.prototype.remove.call(this, _item);
                var $keySelector, $valueSelector;
                var keyValue = item.elem.find(this.keySelector).val();
                var value = item.elem.find(this.valueSelector).val();
                this.findAll().each(
                    function ()
                    {
                        $keySelector = $(this).find(self.keySelector);
                        $valueSelector = $(this).find(self.valueSelector);
                        if ($keySelector.val() === keyValue)
                        {
                            self.addOption($valueSelector, value);
                        }
                        else if ($valueSelector.val() === value)
                        {
                            self.addOption($keySelector, keyValue);
                        }
                    });
                item.elem.find('select').off(this.eventSuffix);
            },

            collectOptions: function (options, keyValue)
            {
                var self = this;
                var optSelector, val;
                this.findAll().each(
                    function ()
                    {
                        val = $(this).find(self.valueSelector).val();
                        if (val && $(this).find(self.keySelector).val() === keyValue)
                        {
                            optSelector = Utils.sformat.call('option[value="{0}"]', val);
                            if (options.indexOf(optSelector) === -1)
                            {
                                options.push(optSelector);
                            }
                        }
                    });
            },

            eventSuffix: '.mdm'
        };
        Utils.inherit(Console.MappedDistinctMultiselect, Console.DistinctMultiselect);

        // A control to manage a select filter
        // @param elem {jquery} - root element of the div
        // @param context {jquery} - context for the callback
        // @param callback {function} - function to execute when filter is triggered
        Console.SelectFilter = function (elem, context, callback)
        {
            this.callback = callback.bind(context);
            this.selectElem = elem.find('select');
            this.options = this.selectElem.find('option[value]');
            this.selected = [];

            this.filterButtons = $(document.createElement('label'))
                .addClass('filter-buttons')
                .appendTo(elem);

            this.selectElem.on('click keypress', this.filter.bind(this));
            this.selectElem.on('blur', function ()
            {
                $(this).val('');
            });
        };

        Console.SelectFilter.prototype =
        {
            callback: undefined,
            selectElem: undefined,
            options: undefined,
            selected: undefined,
            filterButtons: undefined,
            isDisabled: undefined,

            setDisabled: function (isDisabled)
            {
                this.selectElem.prop('disabled', isDisabled);
                this.filterButtons.toggleClass('disabled-buttons', isDisabled);
                this.isDisabled = isDisabled;
            },

            filter: function (event)
            {
                if (event.type === 'keypress')
                {
                    if (event.which !== 13)
                    {
                        return;
                    }
                }
                if (!this.isDisabled)
                {
                    var self = this;
                    var $target = $(event.target);
                    var name = $target.val() || $target.closest('.filter-button').attr('name');
                    if (name)
                    {
                        var index = this.selected.indexOf(name);
                        if (index === -1)
                        {
                            // item is being added to filter
                            // remove from options
                            this.selected.push(name);
                            this.selectElem.find(Utils.sformat.call('option[value="{0}"]', name)).remove();
                            this.filterButtons.append(this.addFilterButton(name));
                        }
                        else
                        {
                            // item is being removed from filter
                            // rebuild application options
                            this.selected.splice(index, 1);
                            this.selectElem.find('option[value]').remove();
                            this.options.each(function ()
                            {
                                var $option = $(this);
                                if (self.selected.indexOf($option.val()) === -1)
                                {
                                    self.selectElem.append($option);
                                }
                            });
                            $target.closest('.filter-button').remove();
                            this.selectElem.val('');
                            this.selectElem.focus();
                        }
                        this.callback();
                    }
                    event.stopPropagation();
                }
            },

            addFilterButton: function (name)
            {
                var $button = $(document.createElement('div'))
                    .addClass('filter-button')
                    .attr('name', name);
                var $buttonText = $(document.createElement('div'))
                    .addClass('filter-button-text overflow-ellipsis nowrap')
                    .text(name);
                var $buttonX = $(document.createElement('div'))
                    .addClass('filter-button-x')
                    .attr('title', 'Remove from filter')
                    .attr('tabindex', 0);
                var $x = Utils.Shapes.getX();
                $x.attr('focusable', 'false');
                $button.append($buttonText);
                $button.append($buttonX);
                $buttonX.append($x);
                $buttonX.on('click', this.filter.bind(this));
                $buttonX.on('keydown', function (event)
                {
                    if (event.which === 13)
                    {
                        $buttonX.trigger('click');
                    }
                });
                return $button;
            },

            destroy: function ()
            {
                this.selectElem.off('click keypress blur');
                this.filterButtons.find('.filter-button').off('click');
            }
        };

        Console.TemplateTagField = function (inputElem, tagsElem, tagSelector, fireChangeEvent)
        {
            Console.UINode.call(this, inputElem);
            this.tagsElem = tagsElem;
            this.tagSelector = tagSelector || 'a.button';
            this.fireChangeEvent = fireChangeEvent || false;

            var self = this;
            this.elem.on('select.tag mouseup.tag textchange.tag', this.setSelectionRange.bind(this));
            this.elem.on('blur.tag',
                function (event)
                {
                    self.setBlurInfo(event);
                    self.focusElemName = undefined;
                });
            this.elem.on('focus.tag',
                function (event)
                {
                    self.unsetBlurInfo();
                    self.setSelectionRange(event);
                    self.focusElemName = $(this)[0].name;
                });
            this.tagsElem.find(this.tagSelector).on('click.tag', this.addToText.bind(this));
        };
        Console.TemplateTagField.prototype =
        {
            tagsElem: undefined,
            tagSelector: undefined,
            fireChangeEvent: undefined,

            destroy: function ()
            {
                this.elem.off('.tag');
                this.tagsElem.find(this.tagSelector).off('.tag');
                Console.UINode.prototype.destroy.call(this);
            },

            selectionRangeStart: undefined,
            selectionRangeEnd: undefined,
            selectionRangeElemName: undefined,
            blurTimestamp: undefined,
            blurElemName: undefined,
            focusElemName: undefined,

            setSelectionRange: function (event)
            {
                if (!$(event.target).is(':focus'))
                {
                    return;
                }
                var scrollTop = event.target.scrollTop;
                this.selectionRangeElemName = event.target.name;
                if (document.selection)
                {
                    var selectionRange = document.selection.createRange();
                    var rangeDuplicate = selectionRange.duplicate();
                    rangeDuplicate.moveToElementText(event.target);
                    rangeDuplicate.setEndPoint('EndToEnd', selectionRange);
                    var numLineBreaks = rangeDuplicate.text.split('\n').length - 1;
                    var selectedLineBreaks = selectionRange.text.split('\n').length - 1;
                    this.selectionRangeStart = rangeDuplicate.text.length - selectionRange.text.length;
                    this.selectionRangeEnd = rangeDuplicate.text.length;
                    if ($('.ie8, .ie10').length)
                    {
                        this.selectionRangeStart -= numLineBreaks;
                        this.selectionRangeStart += selectedLineBreaks;
                        this.selectionRangeEnd -= numLineBreaks;
                    }
                }
                else
                {
                    this.selectionRangeStart = event.target.selectionStart;
                    this.selectionRangeEnd = event.target.selectionEnd;
                }
                event.target.scrollTop = scrollTop;
            },

            setBlurInfo: function (event)
            {
                this.blurTimestamp = event.timeStamp || (new Date().getTime());
                this.blurElemName = event.target.name;
            },

            unsetBlurInfo: function ()
            {
                this.blurTimestamp = undefined;
                this.blurElemName = undefined;
            },

            addToText: function (event)
            {
                var $target = $(event.target);
                var tagName = $target.closest('[data-tag-name]').attr('data-tag-name');
                var timestamp = event.timeStamp || (new Date().getTime());
                var leftBound = '<<';
                var rightBound = '>>';
                var alreadyHasFocus = this.elem.is(':focus');
                var queryElemVal = this.elem.val();
                var cursorLoc, selectEnd;
                if ((alreadyHasFocus || ((this.blurElemName === this.elem[0].name) && (timestamp - this.blurTimestamp <= 100))) && (this.selectionRangeElemName === this.elem[0].name)
                    && this.selectionRangeStart !== undefined && !isNaN(this.selectionRangeStart) && this.selectionRangeEnd !== undefined && !isNaN(this.selectionRangeEnd))
                {
                    cursorLoc = this.selectionRangeStart;
                    selectEnd = this.selectionRangeEnd;
                }
                else if (document.selection)
                {
                    var selectionRange = document.selection.createRange();
                    var rangeDuplicate = selectionRange.duplicate();
                    rangeDuplicate.moveToElementText(event.target);
                    rangeDuplicate.setEndPoint('EndToEnd', selectionRange);
                    var numLineBreaks = rangeDuplicate.text.split('\n').length - 1;
                    var selectedLineBreaks = selectionRange.text.split('\n').length - 1;
                    cursorLoc = rangeDuplicate.text.length - selectionRange.text.length;
                    selectEnd = rangeDuplicate.text.length;
                    if ($('.ie8, .ie10').length)
                    {
                        cursorLoc -= numLineBreaks;
                        cursorLoc += selectedLineBreaks;
                        selectEnd -= numLineBreaks;
                    }
                }
                else if (this.elem[0].selectionStart !== undefined && !isNaN(this.elem[0].selectionStart) && this.elem[0].selectionEnd !== undefined && !isNaN(this.elem[0].selectionEnd))
                {
                    cursorLoc = this.elem[0].selectionStart;
                    selectEnd = this.elem[0].selectionEnd;
                }
                else
                {
                    cursorLoc = queryElemVal.length;
                    selectEnd = queryElemVal.length
                }
                if (!alreadyHasFocus)
                {
                    this.elem.focus();
                }
                var newValue = queryElemVal.slice(0, cursorLoc) + leftBound + tagName + rightBound + queryElemVal.slice(selectEnd);
                this.elem.val(newValue);
                cursorLoc = cursorLoc + leftBound.length + tagName.length + rightBound.length;
                if (this.elem[0].setSelectionRange)
                {
                    this.elem[0].setSelectionRange(cursorLoc, cursorLoc);
                }
                else if (this.elem[0].createTextRange)
                {
                    var range = this.elem[0].createTextRange();
                    range.collapse(true);
                    range.moveEnd('character', cursorLoc);
                    range.moveStart('character', cursorLoc);
                    range.select();
                }
                else
                {
                    this.elem[0].selectionStart = cursorLoc;
                    this.elem[0].selectionEnd = this.elem[0].selectionStart;
                }
                this.selectionRangeElemName = this.elem[0].name;
                this.selectionRangeStart = cursorLoc;
                this.selectionRangeEnd = cursorLoc;
                this.focusElemName = this.elem[0].name;
                this.unsetBlurInfo();

                if (this.fireChangeEvent)
                {
                    this.elem.change();
                }
            }
        };

        Console.ExpandableParagraph = function (elem, contentSelector, divotSelector)
        {
            Console.UINode.call(this, elem);

            this.contentSelector = contentSelector || '.content';
            this.divotSelector = divotSelector || '.divot-marker';
            this.divot = this.elem.find(this.divotSelector);
            this.openState = true;
            this.placeholder = $(document.createElement('span'));
            this.placeholder.text('\u2026');
            this.elem.append(this.placeholder);
            this.elem.toggleClass('expandable-paragraph', true);

            this.divot.on('click.expandable-paragraph', this.handleToggle.bind(this));
            this.handleToggle();
        };

        Console.ExpandableParagraph.prototype =
        {
            placeholder: undefined,
            divot: undefined,
            contentSelector: undefined,
            divotSelector: undefined,
            openState: undefined,

            handleToggle: function ()
            {
                this.openState = !this.openState;
                this.elem.find(this.contentSelector).toggleClass('hidden', !this.openState);
                this.placeholder.toggleClass('hidden', this.openState);
                this.divot.toggleClass('open', this.openState);
                this.divot.toggleClass('closed', !this.openState);

                this.updateLayout();
                this.onToggle();
                return false;
            },

            destroy: function ()
            {
                this.divot.off('.expandable-paragraph');
                Console.UINode.prototype.destroy.call(this);
            },

            updateLayout: function ()
            {
                Console.UINode.prototype.updateLayout.call(this);
            },

            onToggle: function () { }
        };
        Utils.inherit(Console.ExpandableParagraph, Console.UINode);

        return Console;
    });

// The singleton instance of Console.App . 
define('app', ['Console'], function (Console)
{
    return Console.instance;
});

