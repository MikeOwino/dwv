// namespaces
var dwv = dwv || {};
dwv.image = dwv.image || {};

/**
 * List of view event names.
 *
 * @type {Array}
 */
dwv.image.viewEventNames = [
  'wlchange',
  'wlpresetadd',
  'colourchange',
  'positionchange',
  'opacitychange',
  'alphafuncchange'
];

/**
 * View class.
 *
 * @class
 * @param {Image} image The associated image.
 * Need to set the window lookup table once created
 * (either directly or with helper methods).
 */
dwv.image.View = function (image) {
  // closure to self
  var self = this;

  // listen to appendframe event to update the current position
  //   to add the extra dimension
  image.addEventListener('appendframe', function () {
    // update current position if first appendFrame
    var index = self.getCurrentIndex();
    if (index.length() === 3) {
      // add dimension
      var values = index.getValues();
      values.push(0);
      self.setCurrentIndex(new dwv.math.Index(values));
    }
  });

  /**
   * Window lookup tables, indexed per Rescale Slope and Intercept (RSI).
   *
   * @private
   * @type {Window}
   */
  var windowLuts = {};

  /**
   * Window presets.
   * Minmax will be filled at first use (see view.setWindowLevelPreset).
   *
   * @private
   * @type {object}
   */
  var windowPresets = {minmax: {name: 'minmax'}};

  /**
   * Current window preset name.
   *
   * @private
   * @type {string}
   */
  var currentPresetName = null;

  /**
   * Current window level.
   *
   * @private
   * @type {object}
   */
  var currentWl = null;

  /**
   * colour map.
   *
   * @private
   * @type {object}
   */
  var colourMap = dwv.image.lut.plain;
  /**
   * Current position as a Point3D.
   * Store position and not index to stay geometry independent.
   *
   * @private
   * @type {dwv.math.Index}
   */
  var currentPosition = null;
  /**
   * View orientation. Undefined will use the original slice ordering.
   *
   * @private
   * @type {object}
   */
  var orientation;

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  var listenerHandler = new dwv.utils.ListenerHandler();

  /**
   * Get the associated image.
   *
   * @returns {Image} The associated image.
   */
  this.getImage = function () {
    return image;
  };
  /**
   * Set the associated image.
   *
   * @param {Image} inImage The associated image.
   */
  this.setImage = function (inImage) {
    image = inImage;
  };

  /**
   * Get the view orientation.
   *
   * @returns {dwv.math.Matrix33} The orientation matrix.
   */
  this.getOrientation = function () {
    return orientation;
  };

  /**
   * Set the view orientation.
   *
   * @param {dwv.math.Matrix33} mat33 The orientation matrix.
   */
  this.setOrientation = function (mat33) {
    orientation = mat33;
  };

  /**
   * Initialise the view: set initial index.
   */
  this.init = function () {
    this.setInitialIndex();
  };

  /**
   * Set the initial index to 0.
   */
  this.setInitialIndex = function () {
    var geometry = image.getGeometry();
    var values = new Array(geometry.getSize().length());
    values.fill(0);
    this.setCurrentIndex(new dwv.math.Index(values), true);
  };

  /**
   * Get the milliseconds per frame from frame rate.
   *
   * @param {number} recommendedDisplayFrameRate Recommended Display Frame Rate.
   * @returns {number} The milliseconds per frame.
   */
  this.getPlaybackMilliseconds = function (recommendedDisplayFrameRate) {
    if (!recommendedDisplayFrameRate) {
      // Default to 10 FPS if none is found in the meta
      recommendedDisplayFrameRate = 10;
    }
    // round milliseconds per frame to nearest whole number
    return Math.round(1000 / recommendedDisplayFrameRate);
  };

  /**
   * Per value alpha function.
   *
   * @param {*} _value The pixel value. Can be a number for monochrome
   *  data or an array for RGB data.
   * @returns {number} The coresponding alpha [0,255].
   */
  var alphaFunction = function (_value) {
    // default always returns fully visible
    return 0xff;
  };

  /**
   * Get the alpha function.
   *
   * @returns {Function} The function.
   */
  this.getAlphaFunction = function () {
    return alphaFunction;
  };

  /**
   * Set alpha function.
   *
   * @param {Function} func The function.
   * @fires dwv.image.View#alphafuncchange
   */
  this.setAlphaFunction = function (func) {
    alphaFunction = func;
    /**
     * Alpha func change event.
     *
     * @event dwv.image.View#alphafuncchange
     * @type {object}
     */
    fireEvent({
      type: 'alphafuncchange'
    });
  };

  /**
   * Get the window LUT of the image.
   * Warning: can be undefined in no window/level was set.
   *
   * @param {object} rsi Optional image rsi, will take the one of the
   *   current slice otherwise.
   * @returns {Window} The window LUT of the image.
   * @fires dwv.image.View#wlchange
   */
  this.getCurrentWindowLut = function (rsi) {
    // check position
    if (!this.getCurrentIndex()) {
      this.setInitialIndex();
    }
    var currentIndex = this.getCurrentIndex();
    // use current rsi if not provided
    if (typeof rsi === 'undefined') {
      rsi = image.getRescaleSlopeAndIntercept(currentIndex);
    }

    // get the current window level
    var wl = null;
    // special case for 'perslice' presets
    if (currentPresetName &&
      typeof windowPresets[currentPresetName] !== 'undefined' &&
      typeof windowPresets[currentPresetName].perslice !== 'undefined' &&
      windowPresets[currentPresetName].perslice === true) {
      // get the preset for this slice
      var offset = image.getSecondaryOffset(currentIndex);
      wl = windowPresets[currentPresetName].wl[offset];
    }
    // regular case
    if (!wl) {
      // if no current, use first id
      if (!currentWl) {
        this.setWindowLevelPresetById(0, true);
      }
      wl = currentWl;
    }

    // get the window lut
    var wlut = windowLuts[rsi.toString()];
    if (typeof wlut === 'undefined') {
      // create the rescale lookup table
      var rescaleLut = new dwv.image.RescaleLut(
        image.getRescaleSlopeAndIntercept(0), image.getMeta().BitsStored);
      // create the window lookup table
      var windowLut = new dwv.image.WindowLut(
        rescaleLut, image.getMeta().IsSigned);
      // store
      this.addWindowLut(windowLut);
      wlut = windowLut;
    }

    // update lut window level if not present or different from previous
    var lutWl = wlut.getWindowLevel();
    if (!wl.equals(lutWl)) {
      // set lut window level
      wlut.setWindowLevel(wl);
      wlut.update();
      // fire change event
      if (!lutWl ||
        lutWl.getWidth() !== wl.getWidth() ||
        lutWl.getCenter() !== wl.getCenter()) {
        fireEvent({
          type: 'wlchange',
          value: [wl.getCenter(), wl.getWidth()],
          wc: wl.getCenter(),
          ww: wl.getWidth(),
          skipGenerate: true
        });
      }
    }

    // return
    return wlut;
  };
  /**
   * Add the window LUT to the list.
   *
   * @param {Window} wlut The window LUT of the image.
   */
  this.addWindowLut = function (wlut) {
    var rsi = wlut.getRescaleLut().getRSI();
    windowLuts[rsi.toString()] = wlut;
  };

  /**
   * Get the window presets.
   *
   * @returns {object} The window presets.
   */
  this.getWindowPresets = function () {
    return windowPresets;
  };

  /**
   * Get the window presets names.
   *
   * @returns {object} The list of window presets names.
   */
  this.getWindowPresetsNames = function () {
    return Object.keys(windowPresets);
  };

  /**
   * Set the window presets.
   *
   * @param {object} presets The window presets.
   */
  this.setWindowPresets = function (presets) {
    windowPresets = presets;
  };

  /**
   * Set the default colour map.
   *
   * @param {object} map The colour map.
   */
  this.setDefaultColourMap = function (map) {
    colourMap = map;
  };

  /**
   * Add window presets to the existing ones.
   *
   * @param {object} presets The window presets.
   */
  this.addWindowPresets = function (presets) {
    var keys = Object.keys(presets);
    var key = null;
    for (var i = 0; i < keys.length; ++i) {
      key = keys[i];
      if (typeof windowPresets[key] !== 'undefined') {
        if (typeof windowPresets[key].perslice !== 'undefined' &&
          windowPresets[key].perslice === true) {
          throw new Error('Cannot add perslice preset');
        } else {
          windowPresets[key] = presets[key];
        }
      } else {
        // add new
        windowPresets[key] = presets[key];
        // fire event
        /**
         * Window/level add preset event.
         *
         * @event dwv.image.View#wlpresetadd
         * @type {object}
         * @property {string} name The name of the preset.
         */
        fireEvent({
          type: 'wlpresetadd',
          name: key
        });
      }
    }
  };

  /**
   * Get the colour map of the image.
   *
   * @returns {object} The colour map of the image.
   */
  this.getColourMap = function () {
    return colourMap;
  };
  /**
   * Set the colour map of the image.
   *
   * @param {object} map The colour map of the image.
   * @fires dwv.image.View#colourchange
   */
  this.setColourMap = function (map) {
    colourMap = map;
    /**
     * Color change event.
     *
     * @event dwv.image.View#colourchange
     * @type {object}
     * @property {Array} value The changed value.
     * @property {number} wc The new window center value.
     * @property {number} ww The new window wdth value.
     */
    fireEvent({
      type: 'colourchange',
      wc: this.getCurrentWindowLut().getWindowLevel().getCenter(),
      ww: this.getCurrentWindowLut().getWindowLevel().getWidth()
    });
  };

  /**
   * Get the current position.
   *
   * @returns {dwv.math.Point} The current position.
   */
  this.getCurrentPosition = function () {
    return currentPosition;
  };

  /**
   * Get the current index.
   *
   * @returns {dwv.math.Index} The current index.
   */
  this.getCurrentIndex = function () {
    var position = this.getCurrentPosition();
    if (!position) {
      return null;
    }
    var geometry = this.getImage().getGeometry();
    return geometry.worldToIndex(position);
  };

  /**
   * Check is the provided position can be set.
   *
   * @param {dwv.math.Point} position The position.
   * @returns {boolean} True is the position is in bounds.
   */
  this.canSetPosition = function (position) {
    var geometry = image.getGeometry();
    var index = geometry.worldToIndex(position);
    var dirs = [this.getScrollIndex()];
    if (index.length() === 4) {
      dirs.push(3);
    }
    return geometry.isIndexInBounds(index, dirs);
  };

  /**
   * Get the origin at a given position.
   *
   * @param {dwv.math.Point} position The position.
   * @returns {dwv.math.Point} The origin.
   */
  this.getOrigin = function (position) {
    var geometry = image.getGeometry();
    var originIndex = 0;
    if (typeof position !== 'undefined') {
      var index = geometry.worldToIndex(position);
      // index is reoriented, 2 is scroll index
      originIndex = index.get(2);
    }
    return geometry.getOrigins()[originIndex];
  };

  /**
   * Set the current position.
   *
   * @param {dwv.math.Point} position The new position.
   * @param {boolean} silent Flag to fire event or not.
   * @returns {boolean} False if not in bounds
   * @fires dwv.image.View#positionchange
   */
  this.setCurrentPosition = function (position, silent) {
    // send invalid event if not in bounds
    var geometry = image.getGeometry();
    var index = geometry.worldToIndex(position);
    var dirs = [this.getScrollIndex()];
    if (index.length() === 4) {
      dirs.push(3);
    }
    if (!geometry.isIndexInBounds(index, dirs)) {
      if (!silent) {
        // fire event with valid: false
        fireEvent({
          type: 'positionchange',
          value: [
            index.getValues(),
            position.getValues(),
          ],
          valid: false
        });
      }
      return false;
    }
    return this.setCurrentIndex(index, silent);
  };

  /**
   * Set the current index.
   *
   * @param {dwv.math.Index} index The new index.
   * @param {boolean} silent Flag to fire event or not.
   * @returns {boolean} False if not in bounds.
   * @fires dwv.image.View#positionchange
   */
  this.setCurrentIndex = function (index, silent) {
    // check input
    if (typeof silent === 'undefined') {
      silent = false;
    }

    var geometry = image.getGeometry();
    var position = geometry.indexToWorld(index);

    // check if possible
    var dirs = [this.getScrollIndex()];
    if (index.length() === 4) {
      dirs.push(3);
    }
    if (!geometry.isIndexInBounds(index, dirs)) {
      // do no send invalid positionchange event: avoid empty repaint
      return false;
    }

    // calculate diff dims before updating internal
    var diffDims = null;
    var currentIndex = null;
    if (this.getCurrentPosition()) {
      currentIndex = this.getCurrentIndex();
    }
    if (currentIndex) {
      if (currentIndex.canCompare(index)) {
        diffDims = currentIndex.compare(index);
      } else {
        diffDims = [];
        var minLen = Math.min(currentIndex.length(), index.length());
        for (var i = 0; i < minLen; ++i) {
          if (currentIndex.get(i) !== index.get(i)) {
            diffDims.push(i);
          }
        }
        var maxLen = Math.max(currentIndex.length(), index.length());
        for (var j = minLen; j < maxLen; ++j) {
          diffDims.push(j);
        }
      }
    } else {
      diffDims = [];
      for (var k = 0; k < index.length(); ++k) {
        diffDims.push(k);
      }
    }

    // assign
    currentPosition = position;

    if (!silent) {
      /**
       * Position change event.
       *
       * @event dwv.image.View#positionchange
       * @type {object}
       * @property {Array} value The changed value as [index, pixelValue].
       * @property {Array} diffDims An array of modified indices.
       */
      var posEvent = {
        type: 'positionchange',
        value: [
          index.getValues(),
          position.getValues(),
        ],
        diffDims: diffDims,
        data: {
          imageUid: image.getImageUid(index)
        }
      };

      // add value if possible
      if (image.canQuantify()) {
        var pixValue = image.getRescaledValueAtIndex(index);
        posEvent.value.push(pixValue);
      }

      // fire
      fireEvent(posEvent);
    }

    // all good
    return true;
  };

  /**
   * Set the view window/level.
   *
   * @param {number} center The window center.
   * @param {number} width The window width.
   * @param {string} name Associated preset name, defaults to 'manual'.
   * Warning: uses the latest set rescale LUT or the default linear one.
   * @param {boolean} silent Flag to launch events with skipGenerate.
   * @fires dwv.image.View#wlchange
   */
  this.setWindowLevel = function (center, width, name, silent) {
    // window width shall be >= 1 (see https://www.dabsoft.ch/dicom/3/C.11.2.1.2/)
    if (width < 1) {
      return;
    }

    // check input
    if (typeof name === 'undefined') {
      name = 'manual';
    }
    if (typeof silent === 'undefined') {
      silent = false;
    }

    // new window level
    var newWl = new dwv.image.WindowLevel(center, width);

    // check if new
    var isNew = !newWl.equals(currentWl);

    // compare to previous if present
    if (isNew) {
      var isNewWidth = currentWl ? currentWl.getWidth() !== width : true;
      var isNewCenter = currentWl ? currentWl.getCenter() !== center : true;
      // assign
      currentWl = newWl;
      currentPresetName = name;

      if (isNewWidth || isNewCenter) {
        /**
         * Window/level change event.
         *
         * @event dwv.image.View#wlchange
         * @type {object}
         * @property {Array} value The changed value.
         * @property {number} wc The new window center value.
         * @property {number} ww The new window wdth value.
         * @property {boolean} skipGenerate Flag to skip view generation.
         */
        fireEvent({
          type: 'wlchange',
          value: [center, width],
          wc: center,
          ww: width,
          skipGenerate: silent
        });
      }
    }
  };

  /**
   * Set the window level to the preset with the input name.
   *
   * @param {string} name The name of the preset to activate.
   * @param {boolean} silent Flag to launch events with skipGenerate.
   */
  this.setWindowLevelPreset = function (name, silent) {
    var preset = this.getWindowPresets()[name];
    if (typeof preset === 'undefined') {
      throw new Error('Unknown window level preset: \'' + name + '\'');
    }
    // special min/max
    if (name === 'minmax' && typeof preset.wl === 'undefined') {
      preset.wl = [this.getWindowLevelMinMax()];
    }
    // default to first
    var wl = preset.wl[0];
    // check if 'perslice' case
    if (typeof preset.perslice !== 'undefined' &&
      preset.perslice === true) {
      var offset = image.getSecondaryOffset(this.getCurrentIndex());
      wl = preset.wl[offset];
    }
    // set w/l
    this.setWindowLevel(
      wl.getCenter(), wl.getWidth(), name, silent);
  };

  /**
   * Set the window level to the preset with the input id.
   *
   * @param {number} id The id of the preset to activate.
   * @param {boolean} silent Flag to launch events with skipGenerate.
   */
  this.setWindowLevelPresetById = function (id, silent) {
    var keys = Object.keys(this.getWindowPresets());
    this.setWindowLevelPreset(keys[id], silent);
  };

  /**
   * Clone the image using all meta data and the original data buffer.
   *
   * @returns {dwv.image.View} A full copy of this {dwv.image.View}.
   */
  this.clone = function () {
    var copy = new dwv.image.View(this.getImage());
    for (var key in windowLuts) {
      copy.addWindowLut(windowLuts[key]);
    }
    copy.setListeners(this.getListeners());
    return copy;
  };

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type, will be called with the fired event.
   */
  this.addEventListener = function (type, callback) {
    listenerHandler.add(type, callback);
  };

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  this.removeEventListener = function (type, callback) {
    listenerHandler.remove(type, callback);
  };

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  function fireEvent(event) {
    listenerHandler.fireEvent(event);
  }
};

/**
 * Get the image window/level that covers the full data range.
 * Warning: uses the latest set rescale LUT or the default linear one.
 *
 * @returns {object} A min/max window level.
 */
dwv.image.View.prototype.getWindowLevelMinMax = function () {
  var range = this.getImage().getRescaledDataRange();
  var min = range.min;
  var max = range.max;
  var width = max - min;
  // full black / white images, defaults to 1.
  if (width < 1) {
    dwv.logger.warn('Zero or negative window width, defaulting to one.');
    width = 1;
  }
  var center = min + width / 2;
  return new dwv.image.WindowLevel(center, width);
};

/**
 * Set the image window/level to cover the full data range.
 * Warning: uses the latest set rescale LUT or the default linear one.
 */
dwv.image.View.prototype.setWindowLevelMinMax = function () {
  // calculate center and width
  var wl = this.getWindowLevelMinMax();
  // set window level
  this.setWindowLevel(wl.getCenter(), wl.getWidth(), 'minmax');
};

/**
 * Generate display image data to be given to a canvas.
 *
 * @param {Array} array The array to fill in.
 * @param {dwv.math.Index} index Optional index at which to generate,
 *   otherwise generates at current index.
 */
dwv.image.View.prototype.generateImageData = function (array, index) {
  // check index
  if (typeof index === 'undefined') {
    if (!this.getCurrentIndex()) {
      this.setInitialIndex();
    }
    index = this.getCurrentIndex();
  }

  var image = this.getImage();
  var iterator = dwv.image.getSliceIterator(
    image, index, false, this.getOrientation());

  var photoInterpretation = image.getPhotometricInterpretation();
  switch (photoInterpretation) {
  case 'MONOCHROME1':
  case 'MONOCHROME2':
    dwv.image.generateImageDataMonochrome(
      array,
      iterator,
      this.getAlphaFunction(),
      this.getCurrentWindowLut(),
      this.getColourMap()
    );
    break;

  case 'PALETTE COLOR':
    dwv.image.generateImageDataPaletteColor(
      array,
      iterator,
      this.getAlphaFunction(),
      this.getColourMap(),
      image.getMeta().BitsStored === 16
    );
    break;

  case 'RGB':
    dwv.image.generateImageDataRgb(
      array,
      iterator,
      this.getAlphaFunction(),
      this.getCurrentWindowLut()
    );
    break;

  case 'YBR_FULL':
    dwv.image.generateImageDataYbrFull(
      array,
      iterator,
      this.getAlphaFunction()
    );
    break;

  default:
    throw new Error(
      'Unsupported photometric interpretation: ' + photoInterpretation);
  }
};

/**
 * Increment the provided dimension.
 *
 * @param {number} dim The dimension to increment.
 * @param {boolean} silent Do not send event.
 * @returns {boolean} False if not in bounds.
 */
dwv.image.View.prototype.incrementIndex = function (dim, silent) {
  var index = this.getCurrentIndex();
  var values = new Array(index.length());
  values.fill(0);
  if (dim < values.length) {
    values[dim] = 1;
  } else {
    console.warn('Cannot increment given index: ', dim, values.length);
  }
  var incr = new dwv.math.Index(values);
  var newIndex = index.add(incr);
  return this.setCurrentIndex(newIndex, silent);
};

/**
 * Decrement the provided dimension.
 *
 * @param {number} dim The dimension to increment.
 * @param {boolean} silent Do not send event.
 * @returns {boolean} False if not in bounds.
 */
dwv.image.View.prototype.decrementIndex = function (dim, silent) {
  var index = this.getCurrentIndex();
  var values = new Array(index.length());
  values.fill(0);
  if (dim < values.length) {
    values[dim] = -1;
  } else {
    console.warn('Cannot decrement given index: ', dim, values.length);
  }
  var incr = new dwv.math.Index(values);
  var newIndex = index.add(incr);
  return this.setCurrentIndex(newIndex, silent);
};

/**
 * Get the scroll dimension index.
 *
 * @returns {number} The index.
 */
dwv.image.View.prototype.getScrollIndex = function () {
  var index = null;
  var orientation = this.getOrientation();
  if (typeof orientation !== 'undefined') {
    index = orientation.getThirdColMajorDirection();
  } else {
    index = 2;
  }
  return index;
};

/**
 * Decrement the scroll dimension index.
 *
 * @param {boolean} silent Do not send event.
 * @returns {boolean} False if not in bounds.
 */
dwv.image.View.prototype.decrementScrollIndex = function (silent) {
  return this.decrementIndex(this.getScrollIndex(), silent);
};

/**
 * Increment the scroll dimension index.
 *
 * @param {boolean} silent Do not send event.
 * @returns {boolean} False if not in bounds.
 */
dwv.image.View.prototype.incrementScrollIndex = function (silent) {
  return this.incrementIndex(this.getScrollIndex(), silent);
};
