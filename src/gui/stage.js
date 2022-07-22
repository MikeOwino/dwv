// namespaces
var dwv = dwv || {};
dwv.gui = dwv.gui || {};

/**
 * Window/level binder.
 */
dwv.gui.WindowLevelBinder = function () {
  this.getEventType = function () {
    return 'wlchange';
  };
  this.getCallback = function (layerGroup) {
    return function (event) {
      var viewLayers = layerGroup.getViewLayersByDataIndex(event.dataindex);
      if (viewLayers.length !== 0) {
        var vc = viewLayers[0].getViewController();
        vc.setWindowLevel(event.value[0], event.value[1]);
      }
    };
  };
};

/**
 * Position binder.
 */
dwv.gui.PositionBinder = function () {
  this.getEventType = function () {
    return 'positionchange';
  };
  this.getCallback = function (layerGroup) {
    return function (event) {
      var pos = new dwv.math.Point(event.value[1]);
      var vc = layerGroup.getActiveViewLayer().getViewController();
      vc.setCurrentPosition(pos);
    };
  };
};

/**
 * Zoom binder.
 */
dwv.gui.ZoomBinder = function () {
  this.getEventType = function () {
    return 'zoomchange';
  };
  this.getCallback = function (layerGroup) {
    return function (event) {
      var scale = {
        x: event.value[0],
        y: event.value[1],
        z: event.value[2]
      };
      var center;
      if (event.value.length === 6) {
        center = new dwv.math.Point3D(
          event.value[3],
          event.value[4],
          event.value[5]
        );
      }
      layerGroup.setScale(scale, center);
      layerGroup.draw();
    };
  };
};

/**
 * Offset binder.
 */
dwv.gui.OffsetBinder = function () {
  this.getEventType = function () {
    return 'offsetchange';
  };
  this.getCallback = function (layerGroup) {
    return function (event) {
      layerGroup.setOffset({
        x: event.value[0],
        y: event.value[1],
        z: event.value[2]
      });
      layerGroup.draw();
    };
  };
};

/**
 * Opacity binder. Only propagates to view layers of the same data.
 */
dwv.gui.OpacityBinder = function () {
  this.getEventType = function () {
    return 'opacitychange';
  };
  this.getCallback = function (layerGroup) {
    return function (event) {
      // exit if no data index
      if (typeof event.dataindex === 'undefined') {
        return;
      }
      // propagate to first view layer
      var viewLayers = layerGroup.getViewLayersByDataIndex(event.dataindex);
      if (viewLayers.length !== 0) {
        viewLayers[0].setOpacity(event.value);
        viewLayers[0].draw();
      }
    };
  };
};

/**
 * Stage: controls a list of layer groups and their
 * synchronisation.
 *
 * @class
 */
dwv.gui.Stage = function () {

  // associated layer groups
  var layerGroups = [];
  // active layer group index
  var activeLayerGroupIndex = null;

  // layer group binders
  var binders = [];
  // binder callbacks
  var callbackStore = null;

  /**
   * Get the layer group at the given index.
   *
   * @param {number} index The index.
   * @returns {dwv.gui.LayerGroup} The layer group.
   */
  this.getLayerGroup = function (index) {
    return layerGroups[index];
  };

  /**
   * Get the number of layer groups that form the stage.
   *
   * @returns {number} The number of layer groups.
   */
  this.getNumberOfLayerGroups = function () {
    return layerGroups.length;
  };

  /**
   * Get the active layer group.
   *
   * @returns {dwv.gui.LayerGroup} The layer group.
   */
  this.getActiveLayerGroup = function () {
    return this.getLayerGroup(activeLayerGroupIndex);
  };

  /**
   * Get the view layers associated to a data index.
   *
   * @param {number} index The data index.
   * @returns {Array} The layers.
   */
  this.getViewLayersByDataIndex = function (index) {
    var res = [];
    for (var i = 0; i < layerGroups.length; ++i) {
      res = res.concat(layerGroups[i].getViewLayersByDataIndex(index));
    }
    return res;
  };

  /**
   * Add a layer group to the list.
   *
   * @param {object} htmlElement The HTML element of the layer group.
   * @returns {dwv.gui.LayerGroup} The newly created layer group.
   */
  this.addLayerGroup = function (htmlElement) {
    activeLayerGroupIndex = layerGroups.length;
    var layerGroup = new dwv.gui.LayerGroup(htmlElement, activeLayerGroupIndex);
    // add to storage
    var isBound = callbackStore && callbackStore.length !== 0;
    if (isBound) {
      this.unbindLayerGroups();
    }
    layerGroups.push(layerGroup);
    if (isBound) {
      this.bindLayerGroups();
    }
    // return created group
    return layerGroup;
  };

  /**
   * Get a layer group from an HTML element id.
   *
   * @param {string} id The element id to find.
   * @returns {dwv.gui.LayerGroup} The layer group.
   */
  this.getLayerGroupWithElementId = function (id) {
    return layerGroups.find(function (item) {
      return item.getElementId() === id;
    });
  };

  /**
   * Set the layer groups binders.
   *
   * @param {Array} list The list of binder objects.
   */
  this.setBinders = function (list) {
    if (typeof list === 'undefined' || list === null) {
      throw new Error('Cannot set null or undefined binders');
    }
    if (binders.length !== 0) {
      this.unbindLayerGroups();
    }
    binders = list.slice();
    this.bindLayerGroups();
  };

  /**
   * Empty the layer group list.
   */
  this.empty = function () {
    this.unbindLayerGroups();
    for (var i = 0; i < layerGroups.length; ++i) {
      layerGroups[i].empty();
    }
    layerGroups = [];
    activeLayerGroupIndex = null;
  };

  /**
   * Reset the stage: calls reset on all layer groups.
   */
  this.reset = function () {
    for (var i = 0; i < layerGroups.length; ++i) {
      layerGroups[i].reset();
    }
  };

  /**
   * Draw the stage: calls draw on all layer groups.
   */
  this.draw = function () {
    for (var i = 0; i < layerGroups.length; ++i) {
      layerGroups[i].draw();
    }
  };

  /**
   * Synchronise the fit scale of the group layers.
   */
  this.syncLayerGroupScale = function () {
    var minScale;
    var hasScale = [];
    for (var i = 0; i < layerGroups.length; ++i) {
      var scale = layerGroups[i].calculateFitScale();
      if (typeof scale !== 'undefined') {
        hasScale.push(i);
        if (typeof minScale === 'undefined' || scale < minScale) {
          minScale = scale;
        }
      }
    }
    // exit if no scale
    if (typeof minScale === 'undefined') {
      return;
    }
    // apply min scale to layers
    for (var j = 0; j < layerGroups.length; ++j) {
      if (hasScale.includes(j)) {
        layerGroups[j].setFitScale(minScale);
      }
    }
  };

  /**
   * Bind the layer groups of the stage.
   */
  this.bindLayerGroups = function () {
    if (layerGroups.length === 0 ||
      layerGroups.length === 1 ||
      binders.length === 0) {
      return;
    }
    // create callback store
    callbackStore = new Array(layerGroups.length);
    // add listeners
    for (var i = 0; i < layerGroups.length; ++i) {
      for (var j = 0; j < binders.length; ++j) {
        addEventListeners(i, binders[j]);
      }
    }
  };

  /**
   * Unbind the layer groups of the stage.
   */
  this.unbindLayerGroups = function () {
    if (layerGroups.length === 0 ||
      layerGroups.length === 1 ||
      binders.length === 0 ||
      !callbackStore) {
      return;
    }
    // remove listeners
    for (var i = 0; i < layerGroups.length; ++i) {
      for (var j = 0; j < binders.length; ++j) {
        removeEventListeners(i, binders[j]);
      }
    }
    // clear callback store
    callbackStore = null;
  };

  /**
   * Get the binder callback function for a given layer group index.
   * The function is created if not yet stored.
   *
   * @param {object} binder The layer binder.
   * @param {number} index The index of the associated layer group.
   * @returns {Function} The binder function.
   */
  function getBinderCallback(binder, index) {
    if (typeof callbackStore[index] === 'undefined') {
      callbackStore[index] = [];
    }
    var store = callbackStore[index];
    var binderObj = store.find(function (elem) {
      return elem.binder === binder;
    });
    if (typeof binderObj === 'undefined') {
      // create new callback object
      binderObj = {
        binder: binder,
        callback: function (event) {
          // stop listeners
          removeEventListeners(index, binder);
          // apply binder
          binder.getCallback(layerGroups[index])(event);
          // re-start listeners
          addEventListeners(index, binder);
        }
      };
      callbackStore[index].push(binderObj);
    }
    return binderObj.callback;
  }

  /**
   * Add event listeners for a given layer group index and binder.
   *
   * @param {number} index The index of the associated layer group.
   * @param {object} binder The layer binder.
   */
  function addEventListeners(index, binder) {
    for (var i = 0; i < layerGroups.length; ++i) {
      if (i !== index) {
        layerGroups[index].addEventListener(
          binder.getEventType(),
          getBinderCallback(binder, i)
        );
      }
    }
  }

  /**
   * Remove event listeners for a given layer group index and binder.
   *
   * @param {number} index The index of the associated layer group.
   * @param {object} binder The layer binder.
   */
  function removeEventListeners(index, binder) {
    for (var i = 0; i < layerGroups.length; ++i) {
      if (i !== index) {
        layerGroups[index].removeEventListener(
          binder.getEventType(),
          getBinderCallback(binder, i)
        );
      }
    }
  }
};
