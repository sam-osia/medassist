//---------------------------------------------------------------------
// Copyright (c) Epic Systems Corporation 2018-2018
//---------------------------------------------------------------------
// TITLE:   DictionaryTs.ts
// PURPOSE: Typescript for Dictionary.js
// AUTHOR:  Amanda Van Manen
// REVISION HISTORY:
//   *avm 04/2018 541081 - Initial implementation
//   *avm 05/2018 542765 - Er Diagrams
//---------------------------------------------------------------------
/**
 * Dictionary module
 */
var DictionaryTs = /** @class */ (function () {
    function DictionaryTs() {
        /**
         * Class backing the ER diagrams page
        */
        this.ErDiagrams = /** @class */ (function () {
            /**
             * @description - creates the er diagrams class and initializes all properties and events
             * @param ErDiagramRootElement - the root er diagram element
             */
            function class_1(ErDiagramRootElement) {
                this.elem = ErDiagramRootElement;
                //initialize properties
                this.initialize();
                var self = this;
                //create event handlers
                this.blockDiv.on('click.erDiagrams', function () {
                    self.removeBlocking();
                    //if we found elements to connect, draw the lines
                    if (self.connectors.length > 0) {
                        self.connect();
                    }
                    return false;
                });
                this.html.on('click.erDiagrams', function () {
                    self.removeBlocking();
                    //if we found elements to connect, draw the lines
                    if (self.connectors.length > 0) {
                        self.connect();
                    }
                    return true;
                });
                this.html.on('keyup.erDiagrams', function (event) {
                    //enter event
                    if (event.keyCode === 13) {
                        self.removeBlocking();
                        //if we found elements to connect, draw the lines
                        if (self.connectors.length > 0) {
                            self.connect();
                        }
                    }
                    return true;
                });
                this.window.on('resize.erDiagrams', function () {
                    if (self.connectors.length > 0) {
                        self.connect();
                    }
                });
                this.selectableKeys.on('click.erDiagrams', function () {
                    var elem = $(this);
                    //if it's selected already, redraw the lines and quit out
                    if (elem.hasClass('selected')) {
                        self.removeBlocking();
                        self.connect();
                    }
                    //if not already selected, draw the lines
                    else {
                        self.removeBlocking();
                        self.sortable.addClass('block-active');
                        self.$canvas.addClass('block-active');
                        var linkName = elem.attr('key-link');
                        var sisterKeys = $();
                        //is the key on a lookup table? Or is the key the primary key for the center table self-lookup?
                        //If so, highlight all matching keys on the page
                        if (elem.closest('.sortable-item').length > 0 || elem.closest('#center-table-header').length > 0) {
                            sisterKeys = $('[key-link="' + linkName + '"]');
                        }
                        //if the key is a center table lookup, only highlight the selected key and the single lookup key
                        //also highlight bridge keys if applicable
                        else {
                            var primaryConnector = $('.sortable-item [key-link="' + linkName + '"]');
                            //if the primary connector isn't on a lookup table, it's the primary key of a center table self-lookup
                            if (primaryConnector.length === 0) {
                                primaryConnector = $('#center-table-header [key-link="' + linkName + '"]');
                            }
                            var primaryAndSecondaryConnectors = primaryConnector.add(primaryConnector.closest('.sortable-item').find('.secondary-key'));
                            //length will be three if it's a bridge table. In this case, add all three
                            if (primaryAndSecondaryConnectors.length === 3) {
                                sisterKeys = primaryAndSecondaryConnectors.add(elem);
                            }
                            //otherwise just add the main element
                            else {
                                sisterKeys = primaryConnector.add(elem);
                            }
                        }
                        if (sisterKeys.length > 1) {
                            sisterKeys.addClass('selected');
                            sisterKeys.css('background-color', self.secondaryColorLight);
                            sisterKeys.closest('.sortable-item').addClass('selected');
                            self.blockDiv.addClass('block-active');
                            self.moveIcon.hide();
                            //if we found elements to connect, re-draw the lines as background lines
                            self.connectInBackground();
                        }
                    }
                    return false;
                });
                this.expandableSections.on('keyup.erDiagrams', function (event) {
                    var $this = $(this);
                    //if it's an enter press
                    if (event.keyCode === 13) {
                        self.expandSections($this);
                    }
                });
                this.expandableSections.on('click.erDiagrams', function () {
                    var $this = $(this);
                    self.expandSections($this);
                });
            }
            /**
             * @description - expands and collapses the columns section
             * @param elem the JQuery element that the event was triggered on
             */
            class_1.prototype.expandSections = function (elem) {
                var divots = elem.find('.divot-marker');
                var expandableSection = $(elem.next());
                divots.toggleClass('open');
                expandableSection.toggleClass('open');
            };
            /**
             * @description - initializes properties
             */
            class_1.prototype.initialize = function () {
                this.html = $('html');
                this.window = $(window);
                this.$canvas = $('#er-canvas');
                if (this.$canvas.length > 0) {
                    this.canvas = this.$canvas[0];
                    this.primaryColor = this.$canvas.attr('primary-color');
                    this.secondaryColor = this.$canvas.attr('secondary-color');
                    this.secondaryColorLight = this.$canvas.attr('secondary-color-light');
                    this.canvasContext = this.canvas.getContext('2d');
                }
                this.expandableSections = this.elem.find('.form-divot');
                this.sortable = this.elem.find('.sortable');
                this.sortableCards = this.elem.find('.sortable .sortable-item');
                this.centerTable = this.elem.find('#primary-table-container');
                this.blockDiv = this.elem.find('#block-div');
                this.defaultLineColor = '#828282';
                this.backgroundLineColor = '#ABABAB';
                this.moveIcon = this.elem.find('.move-icon');
                this.connectors = [];
                var self = this;
                //identify the keys that should be connected and push them onto the connectors array
                this.elem.find('[key-connection-side="connector-from"]').each(function () {
                    var $this = $(this);
                    var connectionType = $this.attr('key-link');
                    var toElement = $('[key-link=' + connectionType + '][key-connection-side="connector-to"]');
                    if (toElement.length > 0) {
                        var connection = { from: $this, to: toElement };
                        self.connectors.push(connection);
                    }
                });
                //if we found elements to connect, draw the lines
                if (this.connectors.length > 0) {
                    this.connect();
                }
                //if there's a key in the lookup table that's not in the central table, remove selectable class
                this.elem.find('[key-connection-side="connector-to"]').each(function () {
                    var $this = $(this);
                    var connectionType = $this.attr('key-link');
                    var fromElement = $('[key-link=' + connectionType + '][key-connection-side="connector-from"]');
                    if (fromElement.length == 0) {
                        $this.removeClass('selectable');
                        $this.removeClass('cursor-pointer');
                    }
                });
                this.selectableKeys = this.elem.find('.er-card .selectable');
            };
            /**
             * @description - calls the connect method such that connecting lines for unselected dmcs are drawn in the background
             */
            class_1.prototype.connectInBackground = function () {
                this.connect(true);
            };
            /**
             * @description draws the lines that connect dmcs
             * @param background set to true if connecting lines for unselected dmcs should be drawn in the background
             */
            class_1.prototype.connect = function (background) {
                if (background === void 0) { background = false; }
                //clear the canvas
                this.clearCanvas();
                //draw lines for each pair of connectors
                for (var i = 0; i < this.connectors.length; i++) {
                    var connection = this.connectors[i];
                    this.drawConnectingLine(connection, background);
                }
            };
            /**
            * @description removes connecting lines from the diagram
            */
            class_1.prototype.clearCanvas = function () {
                //set canvas size
                this.canvas.width = this.$canvas.width();
                this.canvas.height = this.$canvas.height();
                //clear the canvas
                this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
            };
            /**
            * @description destroys all events created by the er diagrams page
            */
            class_1.prototype.destroy = function () {
                this.expandableSections.off('click.erDiagrams');
                this.html.off('click.erDiagrams');
                this.window.off('resize.erDiagrams');
                this.selectableKeys.off('click.erDiagrams');
                this.blockDiv.off('click.erDiagrams');
            };
            /**
            * @description draws the lines that connect dmcs
            * @param connection object holding the two element that need to be connected
            * @param background set to true if connecting lines for unselected dmcs should be drawn in the background
            */
            class_1.prototype.drawConnectingLine = function (connection, background) {
                //calculate offsets due to the canvas
                var canvasOffsetX = this.$canvas.offset().left;
                var canvasOffsetY = this.$canvas.offset().top;
                //length of the connecting bumbers
                var fromBumperLength = 15;
                var toBumperLength = 22;
                //height of the legs for the one relationship
                var oneLegHeight = 8;
                //height of the legs for the many relationship
                var manyLegHeight = 8;
                //circle radius
                var radius = 4;
                var fromConnector = connection.from;
                var toConnector = connection.to;
                var toConnectorContainer = toConnector.closest('.connection-border');
                var fromConnectorContainer = fromConnector.closest('.connection-border');
                var isLeftTo = toConnector.closest('#left-card-container').length > 0;
                var isLeftFrom = fromConnector.closest('#left-card-container').length > 0;
                //From connector mimicks right side behavior if it's on the right side, or if it the primary key of a center self-lookup
                var isRightFrom = fromConnector.closest('#right-card-container').length > 0 || (toConnector.closest('#primary-table-container').length > 0);
                var selected = true;
                //if non-selected lines are drawn in the background, search for selected property
                if (background) {
                    selected = fromConnector.hasClass('selected');
                }
                if (!toConnectorContainer.hasClass('dragging')) {
                    //calculate initial and final line positions
                    var initialX = fromConnectorContainer.offset().left - canvasOffsetX;
                    var initialY = fromConnector.offset().top - canvasOffsetY + fromConnector.height() / 2;
                    var finalX = toConnectorContainer.offset().left - canvasOffsetX;
                    var finalY = toConnector.offset().top - canvasOffsetY + toConnector.height() / 2;
                    //add additional offset depending on what side of the diagram the connectors are on
                    if (isLeftTo && isLeftFrom) {
                        initialX = initialX + toConnectorContainer.outerWidth();
                        finalX = finalX + toConnectorContainer.outerWidth();
                    }
                    else if (isLeftTo) {
                        finalX = finalX + toConnectorContainer.outerWidth();
                        fromBumperLength = -fromBumperLength;
                        radius = -radius;
                    }
                    else if (isRightFrom) {
                        toBumperLength = -toBumperLength;
                        fromBumperLength = -fromBumperLength;
                        radius = -radius;
                    }
                    else {
                        initialX = initialX + fromConnectorContainer.outerWidth();
                        toBumperLength = -toBumperLength;
                    }
                    //set stroke styles to not-dashed
                    this.setStrokeStyles(background, selected, false);
                    //draw first bumper
                    var fromX = initialX;
                    var fromY = initialY;
                    var toX = initialX + fromBumperLength;
                    var toY = initialY;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                    //draw many legs
                    fromX = toX;
                    fromY = toY;
                    toX = initialX;
                    toY = initialY + manyLegHeight;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                    toY = initialY - manyLegHeight;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                    //draw circle
                    fromX = fromX + radius;
                    this.drawCircleLine(fromX, fromY, Math.abs(radius));
                    //set stroke styles to dashed
                    this.setStrokeStyles(background, selected, true);
                    //draw connecting line
                    fromX = fromX + radius;
                    toX = finalX + toBumperLength;
                    toY = finalY;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                    //set stroke styles to not-dashed
                    this.setStrokeStyles(background, selected, false);
                    //draw one bumber leg
                    fromX = toX - toBumperLength / 2;
                    fromY = toY - oneLegHeight;
                    toX = fromX;
                    toY = toY + oneLegHeight;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                    //draw last bumper
                    fromX = toX + toBumperLength / 2;
                    fromY = toY - oneLegHeight;
                    toX = finalX;
                    toY = finalY;
                    this.drawStraightLine(fromX, fromY, toX, toY);
                }
            };
            /**
             * @description draws a circle on the canvas
             * @param fromX center circle x coordinate
             * @param fromY center circle y coordinate
             * @param radius radius of the circle
             */
            class_1.prototype.drawCircleLine = function (fromX, fromY, radius) {
                this.canvasContext.beginPath();
                this.canvasContext.arc(fromX, fromY, radius, 0, 2 * Math.PI);
                this.canvasContext.stroke();
            };
            /**
             * @description draws a straight line on the canvas
             * @param fromX from x coordinate
             * @param fromY from y coordinate
             * @param toX to x coordinate
             * @param toY to y coordinate
             */
            class_1.prototype.drawStraightLine = function (fromX, fromY, toX, toY) {
                this.canvasContext.beginPath();
                this.canvasContext.moveTo(fromX, fromY);
                this.canvasContext.lineTo(toX, toY);
                this.canvasContext.stroke();
            };
            /**
            * @description - removes the blocking that's done to hide unselected cards in the background
            */
            class_1.prototype.removeBlocking = function () {
                this.selectableKeys.css('background-color', 'white');
                this.selectableKeys.removeClass('selected');
                this.sortableCards.removeClass('selected');
                this.blockDiv.removeClass('block-active');
                this.sortable.removeClass('block-active');
                this.$canvas.removeClass('block-active');
                this.moveIcon.show();
            };
            /**
             * @description sets styles for the line that's being drawn
             * @param background pass true if the line is being drawn in background mode
             * @param selected - pass true if the line is the connecting line between selected elements
             * @param dash - if the line should be dashed
             */
            class_1.prototype.setStrokeStyles = function (background, selected, dash) {
                this.canvasContext.lineWidth = 1;
                this.canvasContext.shadowBlur = 1;
                this.canvasContext.strokeStyle = this.defaultLineColor;
                this.canvasContext.shadowColor = this.primaryColor;
                if (background) {
                    if (selected) {
                        this.canvasContext.shadowColor = this.secondaryColor;
                    }
                    else {
                        this.canvasContext.shadowBlur = 0;
                        this.canvasContext.strokeStyle = this.backgroundLineColor;
                    }
                }
                if (dash === true) {
                    this.canvasContext.setLineDash([5, 10]);
                }
                else {
                    this.canvasContext.setLineDash([0, 0]);
                }
            };
            return class_1;
        }());
    }
    return DictionaryTs;
}());
//# sourceMappingURL=DictionaryTs.js.map