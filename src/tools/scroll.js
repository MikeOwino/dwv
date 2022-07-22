// namespaces
var dwv = dwv || {};
dwv.tool = dwv.tool || {};

/**
 * Scroll class.
 *
 * @class
 * @param {dwv.App} app The associated application.
 */
dwv.tool.Scroll = function (app) {
  /**
   * Closure to self: to be used by event handlers.
   *
   * @private
   * @type {dwv.tool.Scroll}
   */
  var self = this;
  /**
   * Interaction start flag.
   *
   * @type {boolean}
   */
  this.started = false;
  // touch timer ID (created by setTimeout)
  var touchTimerID = null;

  /**
   * Accumulated wheel event deltaY.
   *
   * @type {number}
   */
  var wheelDeltaY = 0;

  /**
   * Handle mouse down event.
   *
   * @param {object} event The mouse down event.
   */
  this.mousedown = function (event) {
    // stop viewer if playing
    var layerDetails = dwv.gui.getLayerDetailsFromEvent(event);
    var layerGroup = app.getLayerGroupById(layerDetails.groupId);
    var viewLayer = layerGroup.getActiveViewLayer();
    var viewController = viewLayer.getViewController();
    if (viewController.isPlaying()) {
      viewController.stop();
    }
    // start flag
    self.started = true;
    // first position
    self.x0 = event._x;
    self.y0 = event._y;

    // update controller position
    var planePos = viewLayer.displayToPlanePos(event._x, event._y);
    viewController.setCurrentPosition2D(planePos.x, planePos.y);
  };

  /**
   * Handle mouse move event.
   *
   * @param {object} event The mouse move event.
   */
  this.mousemove = function (event) {
    if (!self.started) {
      return;
    }

    var layerDetails = dwv.gui.getLayerDetailsFromEvent(event);
    var layerGroup = app.getLayerGroupById(layerDetails.groupId);
    var viewLayer = layerGroup.getActiveViewLayer();
    var viewController = viewLayer.getViewController();

    // difference to last Y position
    var diffY = event._y - self.y0;
    var yMove = (Math.abs(diffY) > 15);
    // do not trigger for small moves
    if (yMove && viewController.canScroll()) {
      // update view controller
      if (diffY > 0) {
        viewController.decrementScrollIndex();
      } else {
        viewController.incrementScrollIndex();
      }
    }

    // difference to last X position
    var diffX = event._x - self.x0;
    var xMove = (Math.abs(diffX) > 15);
    // do not trigger for small moves
    var imageSize = viewController.getImageSize();
    if (xMove && imageSize.moreThanOne(3)) {
      // update view controller
      if (diffX > 0) {
        viewController.incrementIndex(3);
      } else {
        viewController.decrementIndex(3);
      }
    }

    // reset origin point
    if (xMove) {
      self.x0 = event._x;
    }
    if (yMove) {
      self.y0 = event._y;
    }
  };

  /**
   * Handle mouse up event.
   *
   * @param {object} _event The mouse up event.
   */
  this.mouseup = function (_event) {
    if (self.started) {
      // stop recording
      self.started = false;
    }
  };

  /**
   * Handle mouse out event.
   *
   * @param {object} event The mouse out event.
   */
  this.mouseout = function (event) {
    self.mouseup(event);
  };

  /**
   * Handle touch start event.
   *
   * @param {object} event The touch start event.
   */
  this.touchstart = function (event) {
    // long touch triggers the dblclick
    touchTimerID = setTimeout(self.dblclick, 500);
    // call mouse equivalent
    self.mousedown(event);
  };

  /**
   * Handle touch move event.
   *
   * @param {object} event The touch move event.
   */
  this.touchmove = function (event) {
    // abort timer if move
    if (touchTimerID !== null) {
      clearTimeout(touchTimerID);
      touchTimerID = null;
    }
    // call mouse equivalent
    self.mousemove(event);
  };

  /**
   * Handle touch end event.
   *
   * @param {object} event The touch end event.
   */
  this.touchend = function (event) {
    // abort timer
    if (touchTimerID !== null) {
      clearTimeout(touchTimerID);
      touchTimerID = null;
    }
    // call mouse equivalent
    self.mouseup(event);
  };

  /**
   * Handle mouse wheel event.
   *
   * @param {object} event The mouse wheel event.
   */
  this.wheel = function (event) {
    // deltaMode (deltaY values on my machine...):
    // - 0 (DOM_DELTA_PIXEL): chrome, deltaY mouse scroll = 53
    // - 1 (DOM_DELTA_LINE): firefox, deltaY mouse scroll = 6
    // - 2 (DOM_DELTA_PAGE): ??
    // TODO: check scroll event
    var scrollMin = 52;
    if (event.deltaMode === 1) {
      scrollMin = 5.99;
    }
    wheelDeltaY += event.deltaY;
    if (Math.abs(wheelDeltaY) < scrollMin) {
      return;
    } else {
      wheelDeltaY = 0;
    }

    var up = false;
    if (event.deltaY < 0) {
      up = true;
    }

    var layerDetails = dwv.gui.getLayerDetailsFromEvent(event);
    var layerGroup = app.getLayerGroupById(layerDetails.groupId);
    var viewController =
      layerGroup.getActiveViewLayer().getViewController();
    if (up) {
      viewController.incrementScrollIndex();
    } else {
      viewController.decrementScrollIndex();
    }
  };

  /**
   * Handle key down event.
   *
   * @param {object} event The key down event.
   */
  this.keydown = function (event) {
    event.context = 'dwv.tool.Scroll';
    app.onKeydown(event);
  };
  /**
   * Handle double click.
   *
   * @param {object} event The key down event.
   */
  this.dblclick = function (event) {
    var layerDetails = dwv.gui.getLayerDetailsFromEvent(event);
    var layerGroup = app.getLayerGroupById(layerDetails.groupId);
    var viewController =
      layerGroup.getActiveViewLayer().getViewController();
    viewController.play();
  };

  /**
   * Activate the tool.
   *
   * @param {boolean} _bool The flag to activate or not.
   */
  this.activate = function (_bool) {
    // does nothing
  };

  /**
   * Initialise the tool.
   */
  this.init = function () {
    // does nothing
  };

}; // Scroll class

/**
 * Help for this tool.
 *
 * @returns {object} The help content.
 */
dwv.tool.Scroll.prototype.getHelpKeys = function () {
  return {
    title: 'tool.Scroll.name',
    brief: 'tool.Scroll.brief',
    mouse: {
      mouse_drag: 'tool.Scroll.mouse_drag',
      double_click: 'tool.Scroll.double_click'
    },
    touch: {
      touch_drag: 'tool.Scroll.touch_drag',
      tap_and_hold: 'tool.Scroll.tap_and_hold'
    }
  };
};
