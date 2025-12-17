//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2022
//---------------------------------------------------------------------
// TITLE:   Utils.js
// PURPOSE: Contains client-side javascript plugins for Console
// AUTHOR:  David He
// REVISION HISTORY:
//   dhe  04/2013 256037 - Initial implementation
//   *yh  02/2019 584208 - Update computeTime
//   *moh 08/2019 534575 - Add distanceBetweenElems
//   *kms 03/2020 671143 - Delete numberWithCommas
//   *kms 02/2021 751346 - Add isValidDate, formatDateTime, formatDate, and formatTime
//   *yh  12/2022 937555 - Add convertDateStyle
//---------------------------------------------------------------------

define(['jquery', 'jquery.validate'], function ($)
{

    /* Polyfills for Object and Array.prototype */
    (function ()
    {
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
            Object.create = function (obj) 
            {
                var ctor = function () { };
                ctor.prototype = obj;
                return new ctor();
            };
        }


        /* 
         * Polyfill for Array.prototype.map .
         */
        if (!Array.prototype.map)
        {
            Array.prototype.map = function (f, context)
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
            Array.prototype.forEach = function (f, context)
            {
                var length = this.length;
                for (var i = 0; i < length; i++)
                {
                    f.call(context, this[i]);
                }
            };
        }


        /* 
         * Polyfill for Array.prototype.indexOf .
         */
        if (!Array.prototype.indexOf)
        {
            Array.prototype.indexOf = function (target, fromIndex)
            {
                fromIndex = fromIndex || 0;
                var length = this.length;
                for (var i = fromIndex; i < length; i++)
                {
                    if (this[i] === target)
                    {
                        return i;
                    }
                }
                return -1;
            };
        }


        /* 
         * Polyfill for Array.prototype.lastIndexOf .
         */
        if (!Array.prototype.lastIndexOf)
        {
            Array.prototype.lastIndexOf = function (target, fromIndex)
            {
                fromIndex = fromIndex || this.length - 1;
                for (var i = fromIndex; i >= 0; i--)
                {
                    if (this[i] === target)
                    {
                        return i;
                    }
                }
                return -1;
            };
        }


        /* 
         * Polyfill for Function.prototype.bind .
         */
        if (!Function.prototype.bind)
        {
            Function.prototype.bind = function ()
            {
                var self = this;
                var context = Array.prototype.shift.call(arguments);
                var args = arguments;
                return function ()
                {
                    self.apply(context, args);
                };
            };
        }


        /* 
         * Polyfill for Date.now . 
         */
        if (!Date.now)
        {
            Date.now = function ()
            {
                var now = new Date();
                return now.getTime();
            };
        }

        /*
         * Polyfill for String.prototype.trim .
         */
        if (!String.prototype.trim)
        {
            String.prototype.trim = function ()
            {
                return this.replace(/^\s+|\s+$/, '');
            };
        }
    })();


    var global = this;

    var Utils = {};

    Utils.uniqueIdCounter = 0;

    Utils.getElementUniqueId =
        function ($elem)
        {
            var uniqueId = $elem.attr('data-elem-unique-id');
            if (uniqueId)
            {
                return uniqueId;
            }

            uniqueId = 'id_' + Utils.uniqueIdCounter.toString();
            $elem.attr('data-elem-unique-id', uniqueId);
            Utils.uniqueIdCounter++;

            return uniqueId;
        };


    /**
     * Inherits a class from a list of base classes. 
     * @param {constructor} ctor - The derived class
     * @param {...constructor} arguments - The base classes
     */
    Utils.inherit = function (ctor)
    {
        var prototype = Object.create(arguments[1].prototype);
        prototype.constructor = ctor;
        for (var i = 2; i < arguments.length; i++)
        {
            $.extend(prototype, arguments[i].prototype);
        }
        $.extend(prototype, ctor.prototype);
        ctor.prototype = prototype;
    };

    // Utilities for jQuery's Deferred
    Utils.Deferred =
    {
        /**
         * Returns a promise which resolves immediately with the specified arguments
         * @this {*} The resolving context
         * @param {...*} arguments - The arguments with which to resolve
         * @returns {Promise} The promise
         */
        unit: function ()
        {
            return $.Deferred().resolveWith(this, arguments).promise();
        },

        /**
         * Returns a promise which rejects immediately with the specified arguments
         * @this {*} The rejecting context
         * @param {...*} arguments - The arguments with which to reject
         * @returns {Promise} The promise
         */
        failUnit: function ()
        {
            return $.Deferred().rejectWith(this, arguments).promise();
        },

        /**
         * Returns a promise which never completes
         * @returns {Promise} The promise
         */
        bottomUnit: function ()
        {
            return $.Deferred().promise();
        }
    };

    var Algorithms = Utils.Algorithms =
    {
        /**
         * Returns the index of the first element in a monotonic increasing 
         * sequence not less than the specified value. This method uses binary 
         * search, and runs in O(log(n)) steps where n is the length of the 
         * sequence. 
         * 
         * @this {Array.<T>|function(int):T}
         *     The monotonic increasing sequence. If this is a function, then 
         *     this(n) is the nth element. If this is an array, then this[n] is the 
         *     nth element. 
         * 
         * @param {T} t
         *     The upper bound. 
         * 
         * @param {number} a
         * @param {number} b
         *     The interval on which to search. The interval must have integer 
         *     endpoints, and is inclusive at the bottom and exclusive at the top. 
         *     If the sequence is an array, or is an array-like object, then [a, b) 
         *     defaults to [0, this.length). 
         * 
         * @param {function(T, T):number} compare
         *     The comparision function. This is number comparision by default. 
         * 
         * @returns {number} a integer between [a, b]. 
         * 
         * @example
         *   
         *  var ix = leastUpperBound.call([1, 3, 5, 5, 6], 5);
         *  print(ix); // 2
         *  
         * @example
         * 
         *  var ix = leastUpperBound.call([1, 3, 5, 5, 6], 4);
         *  print(ix); // 2
         *  
         */
        leastUpperBound: function (t, a, b, compare)
        {
            var xs = typeof this === 'function'
                ? this
                : (function (ix) { return this[ix]; }).bind(this);

            if (typeof this !== 'function' && 'length' in this)
            {
                a = a || 0;
                b = b || this.length;
            }

            compare = compare || function (a, b) { return a - b; };

            var rec = function (a, b)
            {
                if (a === b)
                {
                    return a;
                }

                if (a + 1 === b)
                {
                    return compare(t, xs(a)) <= 0 ? a : b;
                }

                var mid = Math.floor(a + (b - a) / 2);
                return compare(t, xs(mid)) < 0
                    ? rec(a, mid)
                    : rec(mid, b);
            };
            return rec(a, b);
        },

        /**
         * Returns the index of the last element in a monotonic increasing 
         * sequence less than the specified value. The parameters to this method 
         * are identical to those of leastUpperBound. See leastUpperBound for more 
         * information. 
         * 
         * @returns {number} a integer between [a - 1, b - 1]. 
         * 
         * 
         * @example
         *   
         *  var ix = greatestStrictLowerBound.call([1, 3, 5, 5, 6], 5);
         *  print(ix); // 1
         *  
         * @example
         * 
         *  var ix = greatestStrictLowerBound.call([1, 3, 5, 5, 6], 4);
         *  print(ix); // 1
         *  
         */
        greatestStrictLowerBound: function ()
        {
            return Algorithms.leastUpperBound.apply(this, arguments) - 1;
        },


        /**
         * Returns the index of the first element in a monotonic increasing 
         * sequence greater than the specified value. The parameters to this method 
         * are identical to those of leastUpperBound. See leastUpperBound for more 
         * information. 
         * 
         * @returns {number} a integer between [a, b]. 
         * 
         * 
         * @example
         *   
         *  var ix = leastStrictUpperBound.call([1, 3, 5, 5, 6], 5);
         *  print(ix); // 4
         *  
         * @example
         * 
         *  var ix = leastStrictUpperBound.call([1, 3, 5, 5, 6], 4);
         *  print(ix); // 2
         *  
         */
        leastStrictUpperBound: function (t, a, b, compare)
        {
            var xs = typeof this === 'function'
                ? this
                : (function (ix) { return this[ix]; }).bind(this);

            if (typeof this !== 'function' && 'length' in this)
            {
                a = a || 0;
                b = b || this.length;
            }

            compare = compare || function (a, b) { return a - b; };

            var rec = function (a, b)
            {
                if (a === b)
                {
                    return a;
                }

                if (a + 1 === b)
                {
                    return compare(t, xs(a)) < 0 ? a : b;
                }

                var mid = Math.floor(a + (b - a) / 2);
                return compare(t, xs(mid)) < 0
                    ? rec(a, mid)
                    : rec(mid, b);
            };
            return rec(a, b);
        },

        /**
         * Returns the index of the last element in a monotonic increasing 
         * sequence not greater than the specified value. The parameters to this 
         * method are identical to those of leastUpperBound. See leastUpperBound 
         * for more information. 
         * 
         * @returns {number} a integer between [a - 1, b - 1]. 
         * 
         * 
         * @example
         *   
         *  var ix = greatestLowerBound.call([1, 3, 5, 5, 6], 5);
         *  print(ix); // 3
         *  
         * @example
         * 
         *  var ix = greatestLowerBound.call([1, 3, 5, 5, 6], 4);
         *  print(ix); // 1
         *  
         */
        greatestLowerBound: function ()
        {
            return Algorithms.leastStrictUpperBound.apply(this, arguments) - 1;
        },

        // Returns the set difference of two objects
        // @param {object<string, var>} minuend: An object with string keys
        // @param {object<string, var>} subtrahend: An object with string keys
        // @returns {object<string, bool>} The set of string keys contained in minuend, but not subtrahend
        setMinus: function (minuend, subtrahend)
        {
            if (!minuend)
            {
                return {};
            }
            else if (!subtrahend)
            {
                subtrahend = {};
            }

            var difference = {};
            for (var key in minuend)
            {
                if (minuend.hasOwnProperty(key))
                {
                    if (!subtrahend[key])
                    {
                        difference[key] = true;
                    }
                }
            }

            return difference;
        }
    };

    Utils.isArray = function (arrayMaybe)
    {
        return arrayMaybe && arrayMaybe.constructor === Array;
    };

    Utils.isNumber = function (numberMaybe)
    {
        return (typeof numberMaybe === 'number') && !isNaN(numberMaybe);
    };

    Utils.isValidDate = function (dateMaybe)
    {
        return (dateMaybe instanceof Date) && !isNaN(dateMaybe);
    };

    // Meant to mimic the behavior of DWConsole.FormatDateTime
    Utils.formatDateTime = function (date, dateStyle, timeStyle)
    {
        return this.formatDate(date, dateStyle, true) + " " + this.formatTime(date, timeStyle);
    };

    Utils.prependWithZeroes = function (stringToModify, desiredLength)
    {
        while (stringToModify.length < desiredLength)
        {
            stringToModify = "0" + stringToModify;
        }
        return stringToModify;
    };

    // date       = a javascript Date object. Assumed to be valid
    // dateStyle  = a string like "mm/dd/yyyy" (from DWConsole.Configuration.DateStyle.Display)
    // prependSingleDigitsWithZeroes = if months like January should be displayed as "01" rather than "1"
    Utils.formatDate = function (date, dateStyle, prependSingleDigitsWithZeroes)
    {
        if (prependSingleDigitsWithZeroes === undefined)  // IE doesn't support default values for parameters, so we've gotta do it this way
        {
            prependSingleDigitsWithZeroes = false;
        }

        var dayString = date.getDate().toString();
        if (prependSingleDigitsWithZeroes)
        {
            dayString = Utils.prependWithZeroes(dayString, 2);
        }

        var monthString = (date.getMonth() + 1).toString();  // plus one becuase the months are 0 indexed
        if (prependSingleDigitsWithZeroes)
        {
            monthString = Utils.prependWithZeroes(monthString, 2);
        }

        var yearString = date.getFullYear();

        return dateStyle.replace('mm', monthString).replace('dd', dayString).replace('yyyy', yearString);
    };

    // date       = a javascript Date object. Assumed to be valid
    // timeStyle  = a string like "HH:mm" or "hh:mm tt" (from DWConsole.Configuration.TimeStyle.Format)
    Utils.formatTime = function (date, timeStyle)
    {
        var hours = date.getHours();
        var minutes = date.getMinutes();

        var is12Hour = timeStyle.indexOf("tt") != -1;

        if (is12Hour)
        {
            return timeStyle.replace('h', hours % 12 ? hours % 12 : 12).replace('mm', minutes < 10 ? '0' + minutes : minutes).replace('tt', hours >= 12 ? 'PM' : 'AM');
        }
        else
        {
            return timeStyle.replace('HH', hours < 10 ? '0' + hours : hours).replace('mm', minutes < 10 ? '0' + minutes : minutes);
        }
    };

    // dateInput  = a string in the provided dateStyle. Assumed to be valid
    // dateFromStyle  = a string like "mm/dd/yyyy" (from DWConsole.Configuration.DateStyle.Display)
    // dateToStyle  = a string like "mm/dd/yyyy" (from DWConsole.Configuration.DateStyle.Display)
    Utils.convertDateStyle = function (dateInput, dateFromStyle, dateToStyle)
    {
        if (dateFromStyle === dateToStyle)
        {
            return dateInput;
        }
        var year, month, day, pieces;
        switch (dateFromStyle)
        {
            case 'mm/dd/yyyy':
                pieces = dateInput.split('/');
                month = pieces[0];
                day = pieces[1];
                year = pieces[2];
                break;
            case 'yyyy.mm.dd':
                pieces = dateInput.split('.');
                year = pieces[0];
                month = pieces[1];
                day = pieces[2];
                break;
            case 'dd/mm/yyyy':
                pieces = dateInput.split('/');
                day = pieces[0];
                month = pieces[1];
                year = pieces[2];
                break;
            case 'dd.mm.yyyy':
                pieces = dateInput.split('.');
                day = pieces[0];
                month = pieces[1];
                year = pieces[2];
                break;
            case 'dd-mm-yyyy':
                pieces = dateInput.split('-');
                day = pieces[0];
                month = pieces[1];
                year = pieces[2];
                break;
            case 'mm-dd-yyyy':
                pieces = dateInput.split('-');
                month = pieces[0];
                day = pieces[1];
                year = pieces[2];
                break;
            default: break;
        }
        return dateToStyle.replace('mm', month).replace('dd', day).replace('yyyy', year);
    };

    /**
     * Formats a string template with the specified values. 
     * 
     * @this {string}
     *     The string template, whose blanks are encoded as {0}, {1}, ... . 
     * 
     * @param {...string} arguments
     *     The arguments to fill into the template. 
     * 
     * @returns {string}
     *     The formatted string. 
     *
     * @example
     *   sformat.call('{0} like {1}!', 'I', 'cats');  // I like cats!
     *     
     */
    Utils.sformat = function ()
    {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number)
        {
            return typeof args[number] !== 'undefined'
                ? args[number]
                : match
                ;
        });
    };

    // Formats a URL string with proper encoding
    // @this {string} - The URL template
    // @param {[string, ...]} arguments - The format field values
    // @returns {string} - A formatted string
    Utils.formatEncoded = function ()
    {
        var args = arguments;
        return this.replace(/{(\d+)}/g,
            function (match, number)
            {
                if (typeof args[number] !== 'undefined')
                {
                    return encodeURIComponent(args[number]);
                }
                else
                {
                    return encodeURIComponent(match);
                }
            });
    };

    // Returns an object { x: bool, y: bool } denoting whether the element has a scrollbar
    Utils.hasScrollbar = function (elem)
    {
        var hasScrollbar = {};
        if (elem.length)
        {
            var e = elem[0];
            hasScrollbar.x = e.scrollWidth > e.clientWidth;
            hasScrollbar.y = e.scrollHeight > e.clientHeight;
        }
        else
        {
            hasScrollbar.x = false;
            hasScrollbar.y = false;
        }

        return hasScrollbar;
    };

    /**
     * Constructs a class instance with the specified argument list. 
     * @this {T.constructor} The constructor
     * @param {Array.*} arguments - The arguments to pass to the constructor
     * @returns {T} The newly constructed instance. 
     */
    Utils.newApply = function ()
    {
        var obj = Object.create(this.prototype);
        this.apply(obj, arguments);
        return obj;
    };

    /**
     * Returns the first element of a sequence satisfying a predicate. 
     * 
     * @this {Array.<T>|function(int):T}
     *     The sequence. If this is an array, then this[n] is the nth element. If 
     *     this is a function, then this(n) is the nth element. The function must 
     *     have a length property which determines the number of elements in the 
     *     sequence. 
     * 
     * @param {function(T):boolean} pred
     *     The predicate. 
     * 
     * @returns {T} The first element satisfying the predicate, or undefined of 
     *     no such element exists. 
     * 
     * @example
     *  
     *  var x = find.call(['blah', '#', '7'], isNumeric);
     *  print(x); // 7
     *  
     */
    Utils.find = function (pred)
    {
        var xs = typeof this === 'function'
            ? this
            : (function (ix) { return this[ix]; }).bind(this);

        pred = typeof pred === 'function'
            ? pred
            : function (x) { return x === pred; };

        for (var i = 0; !('length' in this) || (i < this.length); i += 1)
        {
            var x = xs(i);
            if (pred(x))
            {
                return x;
            }
        }

        return undefined;
    };


    /**
     * Forces a redraw of the specified element. This implementation works only 
     * on webkit browsers. 
     * @param {!DOMElement} elem - The element to redraw
     */
    Utils.forceComputation = function (elem)
    {
        elem.style.display = 'none';
        elem.offsetHeight;
        elem.style.display = 'block';
    };


    /**
     * Converts a domain relative URL to an absolute URL. This method does 
     * nothing if the input URL is already an absolute URL. 
     * @param {string} url - The relative URL
     * @returns {string} The absolute URL
     */
    Utils.toAbsoluteUrl = function (url)
    {
        // Convert relative URL to absolute URL
        if (!/^\w+:\/\//.test(url))
        {
            return global.location.protocol + '//' + global.location.host + url;
        }
        else
        {
            return url;
        }
    };

    /**
     * Escapes HTML characters so that the text is displayed as a character string
     * @param {string} text to display
     * @returns {string} text that the browser will not render as HTML
     */
    Utils.htmlEncode = function (text)
    {
        var element = document.createElement('div');
        element.innerText = text;
        text = element.innerHTML;
        text = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return text;
    };

    /**
     * Returns a promise which resolves after the specified duration. 
     * @param {number} duration - The duration, in seconds, to wait. 
     * @returns {Promise}
     */
    Utils.wait = function (duration)
    {
        var promise = $.Deferred();
        window.setTimeout(function ()
        {
            promise.resolve();
        }, 1000 * duration);
        return promise;
    };

    Utils.isVisible = function (elem)
    {
        return !elem.hasClass('hidden');
    };

    Utils.setVisible = function (elem, isVisible)
    {
        elem.toggleClass('hidden', !isVisible);
    };

    Utils.computeDate = function (str, dateStyle)
    {
        var displayString = str.replace(/\s+/g, '');
        if (/^[twmyTWMY](?:(\+|\-)\d+)?$/.test(displayString))
        {
            var letter = displayString.charAt(0).toLowerCase();
            var direction = 1;
            if (displayString.charAt(1) == "-")
            {
                var direction = -1;
            }
            var increment = Number(displayString.substring(2));
            var date = new Date();
            switch (letter)
            {
                case 't':
                    date.setDate(date.getDate() + (direction * increment));
                    break;
                case 'w':
                    date.setDate(date.getDate() + 7 * (direction * increment));
                    break;
                case 'm':
                    date.setMonth(date.getMonth() + (direction * increment));
                    break;
                case 'y':
                    date.setFullYear(date.getFullYear() + (direction * increment));
                    break;
                default: break;
            }

            if (Utils.isValidDate(date))
            {
                return Utils.formatDate(date, dateStyle);
            }
            else
            {
                return displayString;
            }
        }
        return str;
    };

    Utils.computeTime = function (str, timeStyle)
    {
        var displayString = str.replace(/\s+/g, '');
        if (/^[nhNH](?:[\+\-]\d+)?$/.test(displayString))
        {
            var letterWithOperator = displayString.substr(0, 2).toLowerCase();
            var increment = Number(displayString.substring(2));
            var date = new Date();
            switch (letterWithOperator)
            {
                case 'n+':
                    date.setMinutes(date.getMinutes() + increment);
                    break;
                case 'n-':
                    date.setMinutes(date.getMinutes() - increment);
                    break;
                case 'h+':
                    date.setHours(date.getHours() + increment);
                    break;
                case 'h-':
                    date.setHours(date.getHours() - increment);
                    break;
                default:
                    break;
            }

            if (Utils.isValidDate(date))
            {
                return Utils.formatTime(date, timeStyle);
            }
            else
            {
                return displayString;
            }
        }
        return str;
    };

    Utils.Shapes =
    {
        getDivot: function ()
        {
            var svg = '<svg version="1.1" viewBox="0 0 11 11"><polygon points="3,0 8,5 3,10" /></svg>';
            var $svg = $(svg);
            return $svg;
        },

        getX: function ()
        {
            var svg = '<svg version="1.1" viewBox="0 0 8 8"><polygon points="0,1 1,0 4,3 7,0 8,1 5,4 8,7 7,8 4,5 1,8 0,7 3,4" /></svg>';
            var $svg = $(svg);
            return $svg;
        },

        getCheck: function ()
        {
            var svg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><polygon points="0,9 2,7.1 5.5,10.6 14.1,2.5 16,4.4 5.4,14.4" /></svg>';
            var $svg = $(svg);
            $svg.attr('fill', '#90DA8B');
            $svg.attr('class', 'svg-check');
            return $svg;
        }
    };

    Utils.Browser =
    {
        ie: function ()
        {
            return navigator && navigator.userAgent && navigator.appVersion && (navigator.userAgent.toUpperCase().indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0);
        },

        chrome: function ()
        {
            return navigator && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('chrome') !== -1;
        },

        firefox: function ()
        {
            return navigator && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('firefox') !== -1;
        }
    };
    /**
      * Highlights the specified character in the specified HTML DOM element
      * 
      * @param accessKeyElement - the element to search and the higlight the accesskey in
      * @param accessKey - the access key character
      */
    Utils.highlightAccessKey = function (accessKeyElement, accessKey)
    {
        if (!accessKeyElement.accessKeyHighlighted
            && Utils.isAccessKeyAllowed(accessKey))
        {
            // Add information about how to trigger the hotkey to title to display on hover
            var accessKeyFormat = "Alt+Shift+";
            if (accessKeyElement.title.indexOf(accessKeyFormat) == -1)
            {
                accessKeyElement.title += " (" + accessKeyFormat + accessKey.toUpperCase() + ")";
            }

            if (accessKeyElement.hasChildNodes())
            {
                var childNode, txt, txtNodes, txtContent;

                //find the first text node that contains the access character
                for (var i = 0; i < accessKeyElement.childNodes.length; i++)
                {
                    txt = accessKeyElement.childNodes[i].nodeValue;
                    if (accessKeyElement.childNodes[i].nodeType == Node.TEXT_NODE
                        && txt.toLowerCase().indexOf(accessKey.toLowerCase()) != -1)
                    {
                        childNode = accessKeyElement.childNodes[i];
                        break;
                    }
                }

                if (!childNode)//Search descendants
                {
                    for (var i = 0; i < accessKeyElement.childNodes.length && !childNode; i++)
                    {
                        txtContent = accessKeyElement.childNodes[i].textContent;
                        if (txtContent && txtContent.toLowerCase().indexOf(accessKey.toLowerCase()) != -1)
                        {
                            txtNodes = Utils.getTextNodesIn(accessKeyElement.childNodes[i]);
                            for (var j = 0; j < txtNodes.length && !childNode; j++)
                            {
                                txt = txtNodes[j].nodeValue;
                                if (txt.toLowerCase().indexOf(accessKey.toLowerCase()) != -1)
                                {
                                    childNode = txtNodes[j];
                                }
                            }
                        }
                    }
                }

                if (!childNode)
                {
                    //access character was not found
                    return;
                }

                var pos = txt.toLowerCase().indexOf(accessKey.toLowerCase());
                var span = document.createElement('SPAN');
                var spanText = document.createTextNode(txt.substr(pos, 1));
                span.className = 'access-key';
                span.appendChild(spanText);

                //the text before the access key
                var hotkeyPrefixNode = document.createTextNode(txt.substr(0, pos));
                //the text after the access key
                var hotkeySuffixNode = document.createTextNode(txt.substr(pos + 1));

                if (hotkeyPrefixNode.length > 0)
                {
                    childNode.parentNode.insertBefore(hotkeyPrefixNode, childNode);
                }
                childNode.parentNode.insertBefore(span, childNode);
                if (hotkeySuffixNode.length > 0)
                {
                    childNode.parentNode.insertBefore(hotkeySuffixNode, childNode);
                }
                childNode.parentNode.removeChild(childNode);

                accessKeyElement.accessKeyHighlighted = true;
            }
        }
    };

    Utils.disallowedAccessKeys = ['D'];

    Utils.isAccessKeyAllowed = function (keyChar)
    {
        return Utils.disallowedAccessKeys.indexOf(keyChar.toUpperCase()) == -1;
    }
    /**
     * Returns descendant nodes of type text 
     * 
     * @param domElement - the element to search and the return the text nodes in
     */
    Utils.getTextNodesIn = function (domElement)
    {
        return $(domElement).children().addBack().contents().filter(function ()
        {
            return this.nodeType == Node.TEXT_NODE;
        });
    };

    /*
     * Returns the distance in pixels between the centre of two elements
     * 
     * @param elem1 - first element
     * @param elem1 - second element
     */
    Utils.distanceBetweenElems = function (elem1, elem2)
    {
        var e1Rect = elem1.getBoundingClientRect();
        var e2Rect = elem2.getBoundingClientRect();
        var dx = (e1Rect.left + (e1Rect.right - e1Rect.left) / 2) - (e2Rect.left + (e2Rect.right - e2Rect.left) / 2);
        var dy = (e1Rect.top + (e1Rect.bottom - e1Rect.top) / 2) - (e2Rect.top + (e2Rect.bottom - e2Rect.top) / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        return dist;
    };

    /*
     * Creates a jQuery plugin with the specified name and methods. This supports 
     * creating plugins with a limited form of ad-hoc polymorphism, one based on 
     * the number of arguments to a method. 
     */
    (function ($)
    {
        $.arityplugin = function (pluginName, methods)
        {
            return function (methodName)
            {
                var arity = arguments.length;

                if (typeof methodName === 'string' && methodName in methods)
                {
                    var method;
                    if (typeof methods[methodName] === 'function')
                    {
                        method = methods[methodName];
                    }
                    else if (methods[methodName] instanceof Array)
                    {
                        method = methods[methodName].find(function (f) { return f.length === arity - 1; }, methods[methodName]); //TODO
                    }
                    return method.apply(this, Array.prototype.slice.call(arguments, 1));
                }
                else if (arguments.length === 0 || typeof methodName === 'object')
                {
                    return methods.init.apply(this, arguments);
                }
                else
                {
                    if (pluginName === null)
                    {
                        $.error('Method ' + methodName + ' does not exist');
                    }
                    else
                    {
                        $.error('Method ' + methodName + ' does not exist on jQuery.' + pluginName);
                    }
                }
            };
        };
    }($));


    (function ($)
    {
        /**
         * Gets the attributes of the first element as a key-value map. 
         * @this {jQuery} The element from which to retrieve attribute
         * @returns {!Object} The attributes of the element. 
         */
        $.fn.attrs = function ()
        {
            var attrs = {};

            Array.prototype.forEach.call(this[0].attributes,
                function (attr)
                {
                    attrs[attr.name] = attr.value;
                });

            return attrs;
        };
    })($);


    (function ($)
    {
        /**
         * Replaces the attributes and child elements of an element. 
         * 
         * @this {!jQuery} the element to replace
         * @param {!jQuery} elem - the element with which to replace
         * @returns {!Object} The original element, with the replaced attributes and children. 
         * 
         * @see $.fn.replace
         */
        $.fn.replaceChildrenWith = function (elem)
        {
            return this.each(function ()
            {
                var $this = $(this);

                $this.empty().append(elem.children());
                $this.attr(elem.attrs());
            });
        };
    })($);


    /**
     * @name $.expr.focusable
     * Expression filter for focusable elements, or elements which can be focused 
     * by a mouse click or by tab navigation. 
     */
    (function ($)
    {
        var selectorName = 'focusable';
        $.expr[':'][selectorName] = function (obj)
        {
            var $this = $(obj);
            return $this.filter(':visible')
                .is('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], area[href], object, iframe, [tabindex], [contenteditable]');
        };
    })($);


    /**
     * @name $.expr.navfocusable
     * Expression filter for elements focusable via navigation. These are 
     * focusable elements whose tabindex is not specified or is nonnegative. 
     */
    (function ($)
    {
        var selectorName = 'navfocusable';
        $.expr[':'][selectorName] = function (obj)
        {
            var $this = $(obj);
            return $this.is(':focusable') && ($this.attr('tabindex') || 0) >= 0;
        };
    })($);


    /**
     * @name $.expr.scrollable
     * Expression filter for elements which are scrollable in the vertical 
     * direction. This filter checks whether the computed overflow-y property is 
     * auto, scroll, or hidden.
     */
    (function ($)
    {
        var selectorName = 'scrollable';
        $.expr[':'][selectorName] = function (obj)
        {
            var $this = $(obj);
            return $this.css('overflow-y') !== 'visible';
        };
    })($);


    (function ($)
    {
        /**
         * @name $.fn.enable
         * Toggles whether a set of elements is enabled. 
         * @this {!jQuery} The elements to enable or disable. 
         * @param {boolean} - Whether to enable the elements. 
         * @returns {!jQuery} The elements. 
         */
        $.fn.enable = function (expr)
        {
            return this.prop('disabled', !expr);
        };
    })($);


    (function ($, global, undefined)
    {
        /**
         * @name $.fn.callback
         * Returns the data in the first element using a JSONP-like mechanism. The 
         * first element must be a script element whose code invokes a callback 
         * function with the data as the sole argument. The name of the callback is 
         * read from its data-jsonp attribute.
         * 
         * The script element must not be already attached to an HTML document. This 
         * method destroys the script element upon completion. 
         * 
         * @this {!jQuery} The list of elements. 
         * @returns {*} The data in the first element. 
         * 
         * @example
         * <script id=Ovines type="text/javascript" data-jsonp=setOvines>
         *   setOvies({ Mouflon: 1, Argali: 2, Urial: 3 });
         * </script>
         * 
         * $('#Ovines').callback();  // { Mouflon: 1, Argali: 2, Urial: 3 }
         */
        $.fn.callback = function ()
        {
            var $this = this.first();
            var callback = $this.attr('data-jsonp');

            var response;
            global[callback] = function (obj) { response = obj; };
            $this.appendTo($('head')).remove();

            // Work around IE8 not allowing deletion of globals. 
            try
            {
                delete global[callback];
            } catch (ex)
            {
                global[callback] = undefined;
            }

            return response;
        };
    })($, this);


    /**
     * @name $.fn.borderimage 
     * The borderimage plugin adds image borders to elements. For each element, 
     * this plugin inserts a 3-by-3 grid inside the element. The plugin assigns a 
     * background image to the eight outside cells based on a URL template. 
     */
    (function ($, Utils, undefined)
    {
        var pluginName = 'borderimage';

        var methods =
        {
            /**
             * Creates a image-based border to each element in a list of elements. 
             * 
             * @this {!jQuery} The list of elements
             * @param {!Object=} options - The options to this plugin. See below for a 
             *   description of each option. 
             * @returns {!jQuery} The list of elements. 
             */
            init: function (options)
            {
                var defaults =
                {
                    /*
                     * The top, right, bottom, and left widths of the border. 
                     * @type {Array[number]}
                     */
                    widths: [0, 0, 0, 0],

                    /*
                     * A domain relative URL template specifying the background images 
                     * used in the grid. The template must contain two placeholders for 
                     * the row index and column index of the cells. The cells are 
                     * numbered as follows: 
                     * 
                     *   00 01 02
                     *   10 11 12
                     *   20 21 22
                     * 
                     * If this value is not specified, then the background images will 
                     * not be assigned. Not specifying this parameter is useful when the 
                     * background images are set via a different mechanism, such as a 
                     * stylesheet. 
                     * 
                     * @type {?string}
                     * 
                     * @example 'img/page-section/part{0}{1}.png'
                     */
                    src: undefined
                };
                var settings = $.extend({}, defaults, options);

                return this.each(function ()
                {
                    var $this = $(this);
                    var image = $(document.createElement('div'))
                        .addClass('border-image');

                    for (var i = 0; i <= 2; i += 1)
                    {
                        for (var j = 0; j <= 2; j += 1)
                        {
                            var props =
                            {
                                position: 'absolute'
                            };

                            if (settings.src && !(i === 1 && j === 1))
                            {
                                props.background = '';
                            }

                            var widths = settings.widths;
                            switch (i)
                            {
                                case 0:
                                    props.top = 0;
                                    props.height = widths[0];
                                    break;
                                case 1:
                                    props.top = widths[0];
                                    props.bottom = widths[2];
                                    break;
                                case 2:
                                    props.height = widths[2];
                                    props.bottom = 0;
                                    break;
                            }

                            switch (j)
                            {
                                case 0:
                                    props.left = 0;
                                    props.width = widths[3];
                                    break;
                                case 1:
                                    props.left = widths[3];
                                    props.right = widths[1];
                                    break;
                                case 2:
                                    props.width = widths[1];
                                    props.right = 0;
                                    break;
                            }

                            $(document.createElement('div'))
                                .css(props)
                                .addClass(Utils.sformat.call('part{0}{1}', i.toString(), j.toString()))
                                .appendTo(image);
                        }
                    }

                    image.appendTo($this);
                });
            },

            /**
             * Destroys the border image in the list of elements. 
             * @returns {!jQuery} The list of elements. 
             * @param {boolean=true} keepVisuals Whether to keep visual elements 
             *   created by this plugin
             */
            destroy: function (keepVisuals) 
            {
                if (typeof keepVisuals === 'undefined')
                {
                    keepVisuals = true;
                }

                if (!keepVisuals)
                {
                    $(this).find('.border-image').remove();
                }
            }
        };

        var plugin = $.arityplugin(pluginName, methods);
        $.fn[pluginName] = plugin;
    }($, Utils));


    /**
     * @name $.fn.inputshadow 
     * Creates a shadow element having the same dimensions and position as an 
     * existing input element. The shadow can be used to display visual elements 
     * which cannot be attached to the original input element. This plugin is 
     * used for the placeholder text polyfill and for displaying search icons. 
     */
    (function ($, undefined)
    {
        var pluginName = 'inputshadow';

        var methods =
        {
            init: function ()
            {
                var $this = this.first();

                var shadow = $this.next('.input-shadow');
                var data;

                if (shadow.length === 0)
                {
                    data = { refCount: 0 };
                    shadow = $(document.createElement('div'))
                        .addClass('input-shadow')
                        .data(pluginName, data)
                        .insertAfter($this);
                    methods.update.call($this);
                }
                else
                {
                    data = shadow.data(pluginName);
                }

                data.refCount += 1;

                return shadow;
            },

            update: function ()
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    var shadow = $this.next('.input-shadow');
                    shadow.css({
                        top: $this.position().top,
                        paddingRight: $this.css('padding-right'),
                        paddingBottom: $this.css('padding-bottom'),
                        paddingLeft: $this.css('padding-left'),
                        paddingTop: $this.css('padding-top'),
                        borderTopWidth: $this.css('border-top-width'),
                        borderRightWidth: $this.css('border-right-width'),
                        borderBottomWidth: $this.css('border-bottom-width'),
                        borderLeftWidth: $this.css('border-left-width')
                    })
                        .height($this.height())
                        .width($this.width());
                });
            },

            destroy: function () 
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    var shadow = $this.next('.input-shadow');
                    var data = shadow.data(pluginName);
                    data.refCount -= 1;
                    if (data.refCount === 0)
                    {
                        shadow.remove();
                    }
                });
            }
        };

        var plugin = $.arityplugin(pluginName, methods);
        $.fn[pluginName] = plugin;
    }($));


    /**
     * @name $.fn.placeholder 
     * Polyfill for placeholder text. This plugin displays the placeholder text 
     * of an input element as specified by its placeholder attribute. This plugin 
     * should not be used on browsers which already support displaying 
     * placeholder text. 
     */
    (function ($, undefined)
    {
        var pluginName = 'placeholder';

        var methods =
        {
            init: function ()
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    var shadow = $this.inputshadow();
                    var placeholder = $(document.createElement('div'))
                        .text($this.attr('placeholder'))
                        .addClass('placeholder')
                        .appendTo(shadow);
                    // Hide the placeholder if the search bar is pre-populated.
                    placeholder.toggle($this.val() === '');
                    // Attach event handlers to emulate IE10 placeholder behavior in a way that works in IE8.
                    $this.on('blur.' + pluginName, function ()
                    {
                        placeholder.toggle($this.val() === '');
                    });
                    $this.on('focus.' + pluginName, function ()
                    {
                        placeholder.hide();
                    });
                    placeholder.on('click.' + pluginName, function ()
                    {
                        $this.focus();
                    });
                    placeholder.on('contextmenu.' + pluginName,
                        function (event)
                        {
                            event.preventDefault();
                        });
                    placeholder.on('mousedown.' + pluginName,
                        function (event)
                        {
                            if (event.which === 3)
                            {
                                $this.focus();
                                $this.trigger('contextmenu');
                            }
                        });
                });
            },

            destroy: function () 
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    $this.off('.' + pluginName);
                    var shadow = $this.next('.input-shadow');
                    var placeholder = shadow.children('.placeholder');
                    placeholder.off('.' + pluginName);
                    placeholder.remove();
                    $this.inputshadow('destroy');
                });
            }
        };

        var plugin = $.arityplugin(pluginName, methods);
        $.fn[pluginName] = plugin;
    }($));


    /**
     * @name $.event.special.textchange 
     * A custom jQuery event that is triggered when the text in a text box 
     * changes due to user interaction. This is similar to the change event, 
     * except this event triggers on every key press, whereas the change event 
     * does not trigger until the text box loses focus. 
     */
    (function ($, window)
    {
        var eventName = 'textchange';
        var pluginName = 'textchange';

        $.event.special[eventName] = {
            setup: function ()
            {
                var fn = function ()
                {
                    var $this = $(this);
                    if ($this.data(eventName + '-original') !== $this.val())
                    {
                        $this.trigger(eventName);
                        $this.data(eventName + '-original', $this.val());
                    }
                };
                var $this = $(this);

                // Use input field if available, and not on IE9. 
                if (!$('html').hasClass('lt-ie10'))
                {
                    $this.on('input.' + eventName, fn);
                }
                else
                {
                    $this.on('keydown.' + eventName, function ()
                    {
                        window.setTimeout(fn.bind(this), 1);
                    });
                    $this.on('cut.' + eventName, fn);
                    $this.on('paste.' + eventName, fn);
                    $this.on('change.' + eventName, fn);
                }
            },

            teardown: function ()
            {
                $(this).off('.' + eventName);
            }
        };

        /**
         * @name $.fn.textchange 
         * Attaches a textchange event handler to a list of elements if specified. 
         * Otherwise, triggers the textchange event on the list of elements. 
         * 
         * @this {!jQuery} The list of elements
         * @param {function(Event)=} - The event handler to attach, if specified. 
         * @returns {!jQuery} The list of elements
         */
        $.fn[pluginName] = function (fn)
        {
            if (fn)
            {
                return this.on(eventName, fn);
            }
            else
            {
                return this.trigger(eventName);
            }
        };
    })($, this);


    // $.validator.addRemoteMethod
    // Allow adding remote validation methods more general than jQuery validate's remote method. 
    (function ($)
    {
        $.validator.addRemoteMethod = function (methodName, getPromise)
        {
            $.validator.addMethod(methodName, function (value, element, params)
            {
                if (this.optional(element))
                {
                    return 'dependency-mismatch';
                }
                var previous = this.previousValue(element);
                if (!this.settings.messages[element.name])
                {
                    this.settings.messages[element.name] = {};
                }
                previous.originalMessage = this.settings.messages[element.name][methodName];
                this.settings.messages[element.name][methodName] = previous.message;

                if (this.pending[element.name])
                {
                    return 'pending';
                }
                if (previous.old === value)
                {
                    this.settings.removeLoadingWheel();
                    return previous.valid;
                }

                previous.old = value;
                var validator = this;
                this.startRequest(element);

                getPromise(value, element, params)
                    .done(function (valid, message)
                    {
                        validator.settings.messages[element.name][methodName] = previous.originalMessage;
                        if (valid)
                        {
                            var submitted = validator.formSubmitted;
                            validator.prepareElement(element);
                            validator.formSubmitted = submitted;
                            validator.successList.push(element);
                            validator.showErrors();
                        } else
                        {
                            var errors = {};
                            message = message || validator.defaultMessage(element, methodName);
                            errors[element.name] = previous.message = $.isFunction(message) ? message(value) : message;
                            validator.showErrors(errors);
                        }
                        previous.valid = valid;
                        validator.stopRequest(element, valid);
                        validator.settings.removeLoadingWheel();
                    })
                    .fail(function ()
                    {

                    });
                return 'pending';
            });
        };
    }($));


    /* $.fn.sticky */
    (function ($, undefined)
    {
        var pluginName = 'sticky';
        var plugin = function (expr, val)
        {
            if (expr)
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    if ($this.data(pluginName) !== undefined)
                    {
                        $this.val(val);
                        $this.next('input[hidden]').val(val);
                        return;
                    }

                    var data = {
                        name: $this.attr('name'),
                        val: $this.val()
                    };

                    $this
                        .val(val)
                        .data(pluginName, data)
                        .prop('disabled', true)
                        .addClass('sticky')
                        .removeAttr('name');

                    $(document.createElement('input'))
                        .attr('type', 'hidden')
                        .val(val)
                        .attr('name', data.name)
                        .insertAfter($this);
                });
            }
            else
            {
                return this.each(function ()
                {
                    var $this = $(this);
                    var data = $this.data(pluginName);
                    if (data === undefined)
                    {
                        return;
                    }


                    $this
                        .val(data.val)
                        .attr('name', data.name)
                        .removeData(pluginName)
                        .prop('disabled', false)
                        .removeClass('sticky');

                    $this.next('input[hidden]').remove();
                });
            }
        };
        $.fn[pluginName] = plugin;
    })($);


    // Highlight text in an element that matches a regex pattern
    // From jquery.guruextensions.js with modifications
    (function ($, undefined)
    {
        $.fn.highlight = function (patternArray)
        {
            return this.each(function ()
            {
                for (var x = 0; x < patternArray.length; x++)
                {
                    var pattern = patternArray[x];

                    // If the pattern is empty, don't try to process it
                    if (!$.trim(pattern))
                    {
                        continue;
                    }

                    // Get the text to highlight - just using the inner html of the object at this time
                    var text = $(this).html();

                    // Replace the patterns with highlighted spans.
                    // Regex-deciphering hints:
                    // * We're building a regex to capture the pattern.  (pattern) is passed to $1, wrapping it with a span.
                    // * The /ig options replace all occurrences of the pattern, case-insensitively.
                    // * (?![^<]*) makes sure the match isn't followed by a ">" character, unless there's a preceding "<" (so we don't match inside an html tag).
                    var html = text.replace(new RegExp('(' + pattern + ')(?![^<]*>)', 'ig'), '<span class=\"highlight\">$1</span>');

                    // insert the updated text into the original node
                    $(this).html(html);
                }
            });
        };

        // Remove any highlight spans from an element
        $.fn.removeHighlight = function ()
        {
            var text = $(this).html();
            $(this).html(
                text.replace(/<span class="highlight">(.+?)<\/span>/g, '$1')
            );
            return this;
        };
    })($);

    /* $.fn.enableItem */
    (function ($)
    {
        var pluginName = 'enableItem';
        var plugin = function (enable, val)
        {
            this.enable(enable);
            if (val !== undefined)
            {
                this.val(val);
            }

            return this;
        };
        $.fn[pluginName] = plugin;
    })($);


    /* $.fn.enableBinary */
    (function ($)
    {
        var pluginName = 'enableBinary';
        var plugin = function (enable, checked)
        {
            var label = this.closest('label');

            this.enable(enable);
            label.toggleClass('disabled', !enable);
            if (checked !== undefined)
            {
                this.prop('checked', checked);
            }

            return this;
        };
        $.fn[pluginName] = plugin;
    })($);
    return Utils;
});
