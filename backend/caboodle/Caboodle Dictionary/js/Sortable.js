//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2012-2019
//---------------------------------------------------------------------
// TITLE:   Sortable.js
// PURPOSE: Contains support code for sortable elements in console
// AUTHOR:  Rishi Toshniwal
// REVISION HISTORY:
//   *rt  02/2014 264658 - Initial implementation
//   *avm 05/2018 542765 - Expand module functionality
//   *ap  06/2019 611257 - Tweak to allow Source Preferences to share a rank
//---------------------------------------------------------------------*/

define(['jquery', 'Console', 'Utils', 'css!Sortable'], 
  function($, Console, Utils)
{
  var Algorithms = Utils.Algorithms;
  
  // Sortable plugin to drag and drop the child elements of a passed container element. Container element must have class "sortable".
  // elem {JQuery} - container elements
  // args.sortableItems {string} - selector for sortable elements within the passed container. Default is '> li'.
  // args.connectWith {string} - selector for additional container that elements can be sorted into. Must have class "sortable"
  // args.sortHandle {string} - selector if the sort start click should be restricted to an element within the sortable item
  // args.scrollWindow {boolean} - if the window itself should scroll when the element is sorted off screen. Default behavior is to only scroll within
  //                               a scrollable container element
  var Sortable = function (elem, args) 
  {
    var self = this;
    this.elem = elem;
    this.windowScrollBuffer = 100;
    this.windowScrollDistance = 40;
    this.page = $('.page');
    this.body = $('body');
    this.html = $('html');
    this.window = $(window);

    //set defaults for arguments
    if (typeof(args) === 'undefined')
    {
      args = { sortableItems: undefined, connectWith: undefined, sortHandle: undefined, scrollWindow: undefined };
    }
    if (typeof(args.sortableItems) === 'undefined')
    {
      args.sortableItems = '> li';
    }
    if (typeof(args.connectWith) === 'undefined')
    {
      args.connectWith = '';
    }
    if (typeof(args.sortHandle) === 'undefined')
    {
      args.sortHandle = '';
    }
    if (typeof(args.scrollWindow) === 'undefined')
    {
      args.scrollWindow = false;
    }
    this.args = args;

    //resolve args
    this.dropTargets = elem.add($(args.connectWith));
    this.scrollWindow = args.scrollWindow;
    this.sortables = this.dropTargets.find(args.sortableItems);
    this.anchorSource = this.dropTargets.find(args.sortableItems + '.share-line-anchor');
    var handles = this.sortables.find(args.sortHandle);
    this.sortHandles = handles.length > 0 ? handles : this.sortables;
    // use setCapture only on ie8, even when ie9 and firefox supports it. 
    this.hasCapture = $('html').hasClass('lt-ie9');

    this.scroll = this.elem.closest('.scroll');
    // Create timer if a scrollable region exists
    if (this.scroll.length != 0 || this.scrollWindow)
    {
      this._createTimer();
    }

    this.sortHandles.on('mousedown.' + this.pluginName, function (event)
    {
      self.onMouseDown(event, $(this));
    });

    if (this.anchorSource.length > 0)
    {
      this.applyMultiLineSeparators();
    }
  }

  Sortable.prototype =
  {
    pluginName: 'sortable', 
  
    // If the list has a scrollable ancestor, timer will be 
    // used to scroll the list vertically. Not null. 
    // @type {jQuery}
    scroll: undefined, 
  
    // The item being dragged, or null if nothing is being dragged. 
    // @type {jQuery}
    source: null,

    // The placeholder marking where a dragged item will be dropped. Not null. 
    // @type {jQuery}
    target: undefined, 

    // Whether to use setCapture. True if and only if on ie8, even though ie9 and 
    // firefox support setCapture. 
    // @type {boolean}
    hasCapture: undefined, 

    // The element on which to attach mousemove and mouseout handlers
    // @type {DOMNode}
    captureTarget: null, 

    // A timer which scrolls the scrollable region containing the list. Not 
    // defined if there is no scrollable region. 
    // @type {Console.Timer}
    scrollTimer: undefined, 

    // The last seen y position of the mouse relative to the viewport
    // @type {number}
    mouseClientY: null, 

    //Increase or decrease this to speed up or slow down window scrolling
    // @type {number}
    windowScrollDistance: null,

    // How close to the bottom/top of the window before scrolling happens
    // @type {number}
    windowScrollBuffer: null,

    // page element
    // @type {jQuery}
    page: undefined,

    // body element
    // @type {jQuery}
    body: undefined,

    // html element
    // @type {jQuery}
    html: undefined,

    // window element
    // @type {jQuery}
    window: undefined,

    // passed arguments
    // @type {Object}
    args: undefined,

    // valid droppable targets
    // @type {JQuery}
    dropTargets: undefined,

    // element to select to initiate dragging
    // @type {JQuery}
    sortHandles: undefined,

    // element that should be sorted
    // @type {JQuery}
    sortables: undefined,

    // whether window scrolling happens when sorting off screen
    // @type boolean
    scrollWindow: undefined,

    // sortable element which is the anchor for line sharing (Clarity Source)
    // @type {jQuery}
    anchorSource: undefined,

    destroy: function ()
    {
      if (this.scroll.length || this.scrollWindow)
      {
        this.scrollTimer.stop();
      }

      if (this.source != null)
      {
        $(this.captureTarget).off('.' + this.pluginName);
      }
      if (this.target !== undefined)
      {
        this.target.remove();
      }
      this.sortables.off('mousedown.' + self.pluginName);
    },

    // Grab the item to drag, start the timer if needed
    // Add mousemove and mouseup event to the item being dragged
    // returns true if the onMouseDown event was a success. Otherwise false
    onMouseDown: function (event, sortable) 
    {
      // Only left mouse button
      if (event.which != 1)
      {
        return false;
      }

      event.preventDefault();

        //sortable item that should be moves
      if (sortable.is('.sortable' + this.args.sortableItems))
      {
        // If you click on the anchor item, we will move siblings as well
          if (sortable.hasClass('is-sharing-line'))
        {
          this.source = sortable.add(sortable.siblings('.is-sharing-line'));
        }
        else
        {
          this.source = sortable;
        }
      }
      else
      {
        this.source = sortable.closest(this.args.sortableItems);
      }

      //placeholder item
      this.target = this.source.clone().addClass('placeholder');

      //add dragging class to the element being dragged, the container(s), and the page
      this.dropTargets.addClass('dragging');
      this.source.addClass('dragging');
      this.page.addClass('dragging');
      this.target.insertAfter(this.source.last());

      if (this.scroll.length || this.scrollWindow)
      {
        this.scrollTimer.start();
      }
    
      this.captureTarget = this.hasCapture ? sortable : document;
      if (this.hasCapture) this.captureTarget.setCapture();
    
      $(this.captureTarget).on('mousemove.' + this.pluginName, this.onMouseMove.bind(this));
      $(this.captureTarget).on('mouseup.' + this.pluginName, this.onMouseUp.bind(this));
      return true;
    }, 
  
    // Drop the item being dragged in the target place
    onMouseUp: function (event) 
    {
      var validTarget = this.getValidTarget(event);
      if (validTarget !== undefined)
      {
        this.source.insertAfter(this.target.last());
      }

      this.target.detach();
      this.source.removeClass('dragging');
      this.source = null;
      this.elem.removeClass('dragging');
      this.page.removeClass('dragging');
      this.html.css('cursor', '');
      if (this.scroll.length || this.scrollWindow)
      {
        this.scrollTimer.stop();
      }

      $(this.captureTarget).off('mousemove.' + this.pluginName);
      $(this.captureTarget).off('mouseup.' + this.pluginName);

    }, 

    /**
     * @description evaluates whether the target of the event is a valid drop target
     * @param {jQuery} event - the move event
     * @returns valid sortable container bounding the event, or undefined if that doesn't exist
     */
    getValidTarget: function (event)
    {
      var validTarget;
      var possibleTarget = $(event.target).closest('.sortable');
      if (possibleTarget !== undefined)
      {
        this.dropTargets.each(function ()
        {
          if (this === possibleTarget[0])
          {
            validTarget = possibleTarget;
          }
        });             
      }
      return validTarget;
    },
  

    /**
    * @description When moving determines viable target locations and inserts the placeholder
    * @param {jQuery} event - the move event
    */
    onMouseMove: function(event) 
    {
      event.preventDefault();

      var self = this;

      var boundingContainer = this.getValidTarget(event);

      if (boundingContainer !== undefined)
      {
        this.target.show();

        // list of all the elements that can be rearranged
        var sortableElements = boundingContainer.find(this.args.sortableItems);

        // find the midpoint
        var midPoint = function (ix)
        {
          // skip the source element while retaining monotonicity
          if (sortableElements[ix] == self.source[0])
          {
            if (ix == 0)
            {
              return Number.NEGATIVE_INFINITY;
            }
            else
            {
              ix -= 1;
            }
          }
          var rect = sortableElements[ix].getBoundingClientRect();
          return 0.5 * (rect.top + rect.bottom);
        }

        // Set the target to last element whose midpoint is above the mouse pointer
        var targetIx = Algorithms.leastUpperBound.call(midPoint, event.clientY, 0, sortableElements.length);

        // Insert the placeholder after the target
        if (sortableElements.length === 0)
        {
          boundingContainer.append(this.target);
        }
        else if (targetIx == sortableElements.length)
        {
          if (sortableElements[sortableElements.length - 1] != this.target[0])
          {
            this.target.insertAfter(sortableElements[sortableElements.length - 1]);
          }
        }
        else
        {
          if (sortableElements[targetIx] != this.target[0])
          {
            this.target.insertBefore(sortableElements[targetIx]);
          }
        }
       // Set styles
       this.html.css('cursor', 'move');
       this.source.addClass('dragging');
      }
      //if we're not on a valid grid drop target, remove the placeholder
      else
      {
        this.target.hide();
        this.source.removeClass('dragging');
        this.html.css('cursor', 'not-allowed');
      }
      // Store the last seen mouse cursor position for the scroll timer
      this.mouseClientY = event.clientY;
    },
      // A timer which scrolls the scrollable region containing the sortable elements.
    _createTimer: function()
    {
      var self = this;
      this.scrollTimer = new Console.Timer(
      {
        freq: 5, // hertz
        onTick: function () 
        {
          //if we've got a scrollable target element
          if (self.scroll.length > 0)
          {
            var rect = self.scroll[0].getBoundingClientRect();

            // Difference between the mouse position and the scroll top or the 
            // scroll bottom
            var dScroll = 0;
            dScroll = Math.min(self.mouseClientY - rect.top, dScroll);
            dScroll = Math.max(self.mouseClientY - rect.bottom, dScroll);

            // Coefficient for scrolling velocity
            var coeff = 0.4;

            // Scroll the scrollable region
            self.scroll.scrollTop(self.scroll.scrollTop() + coeff * dScroll);
          }
          //otherwise we're scrolling the actual window
          else
          {
            var windowHeight = self.window.height();
            if (self.body.height() > windowHeight)
            {
              //If the bottom of the container's position minus y is less than the buffer, scroll down
              if (windowHeight - self.mouseClientY <= self.windowScrollBuffer)
              {
                window.scrollBy(0, self.windowScrollDistance);
              }

            //If the top of the container's position plus y is less than the buffer, scroll up
              else if (self.mouseClientY < self.windowScrollBuffer)
              {
                window.scrollBy(0, -self.windowScrollDistance);
              }
            }
          }
        }
      });
    },

    // Add and remove separators from sortable objects
    applyMultiLineSeparators: function ()
    {
      this.sortables.each(function (index, sortable)
      {
        if ($(sortable).hasClass('is-sharing-line') && $(sortable).next().hasClass('is-sharing-line'))
        {
          sortable.innerText = sortable.getAttribute('data-source-name') + ',';
        }
        else
        {
          sortable.innerText = sortable.getAttribute('data-source-name');
        }
      });
    }
  }

  return Sortable;
});
