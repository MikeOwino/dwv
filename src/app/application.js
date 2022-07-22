/** @namespace */
var dwv = dwv || {};

/**
 * Main application class.
 *
 * @class
 * @tutorial examples
 */
dwv.App = function () {
  // closure to self
  var self = this;

  // app options
  var options = null;

  // data controller
  var dataController = null;

  // toolbox controller
  var toolboxController = null;

  // load controller
  var loadController = null;

  // stage
  var stage = null;

  // UndoStack
  var undoStack = null;

  // Generic style
  var style = new dwv.gui.Style();

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  var listenerHandler = new dwv.utils.ListenerHandler();

  /**
   * Get the image.
   *
   * @param {number} index The data index.
   * @returns {dwv.image.Image} The associated image.
   */
  this.getImage = function (index) {
    return dataController.get(index).image;
  };
  /**
   * Get the last loaded image.
   *
   * @returns {dwv.image.Image} The image.
   */
  this.getLastImage = function () {
    return dataController.get(dataController.length() - 1).image;
  };
  /**
   * Set the image at the given index.
   *
   * @param {number} index The data index.
   * @param {dwv.image.Image} img The associated image.
   */
  this.setImage = function (index, img) {
    dataController.setImage(index, img);
  };
  /**
   * Set the last image.
   *
   * @param {dwv.image.Image} img The associated image.
   */
  this.setLastImage = function (img) {
    dataController.setImage(dataController.length() - 1, img);
  };

  /**
   * Add a new image.
   *
   * @param {dwv.image.Image} image The new image.
   * @param {object} meta The image meta.
   * @returns {number} The new image id.
   */
  this.addNewImage = function (image, meta) {
    var id = dataController.length();

    // load start event
    fireEvent({
      type: 'loadstart',
      loadtype: 'image',
      source: 'internal',
      loadid: id
    });

    // add image to data controller
    dataController.addNew(id, image, meta);

    // load item event
    fireEvent({
      type: 'loaditem',
      loadtype: 'image',
      data: meta,
      source: 'internal',
      loadid: id,
      isfirstitem: true
    });

    // optional render
    if (options.viewOnFirstLoadItem) {
      this.render(id);
    }

    // load events
    fireEvent({
      type: 'load',
      loadtype: 'image',
      source: 'internal',
      loadid: id
    });
    fireEvent({
      type: 'loadend',
      loadtype: 'image',
      source: 'internal',
      loadid: id
    });

    return id;
  };

  /**
   * Get the meta data.
   *
   * @param {number} index The data index.
   * @returns {object} The list of meta data.
   */
  this.getMetaData = function (index) {
    return dataController.get(index).meta;
  };

  /**
   * Get the number of loaded data.
   *
   * @returns {number} The number.
   */
  this.getNumberOfLoadedData = function () {
    return dataController.length();
  };

  /**
   * Can the data be scrolled?
   *
   * @returns {boolean} True if the data has a third dimension greater than one.
   */
  this.canScroll = function () {
    var viewLayer = stage.getActiveLayerGroup().getActiveViewLayer();
    var controller = viewLayer.getViewController();
    return controller.canScroll();
  };

  /**
   * Can window and level be applied to the data?
   *
   * @returns {boolean} True if the data is monochrome.
   */
  this.canWindowLevel = function () {
    var viewLayer = stage.getActiveLayerGroup().getActiveViewLayer();
    var controller = viewLayer.getViewController();
    return controller.canWindowLevel();
  };

  /**
   * Get the layer scale on top of the base scale.
   *
   * @returns {object} The scale as {x,y}.
   */
  this.getAddedScale = function () {
    return stage.getActiveLayerGroup().getAddedScale();
  };

  /**
   * Get the base scale.
   *
   * @returns {object} The scale as {x,y}.
   */
  this.getBaseScale = function () {
    return stage.getActiveLayerGroup().getBaseScale();
  };

  /**
   * Get the layer offset.
   *
   * @returns {object} The offset.
   */
  this.getOffset = function () {
    return stage.getActiveLayerGroup().getOffset();
  };

  /**
   * Get the toolbox controller.
   *
   * @returns {object} The controller.
   */
  this.getToolboxController = function () {
    return toolboxController;
  };

  /**
   * Get the active layer group.
   * The layer is available after the first loaded item.
   *
   * @returns {dwv.gui.LayerGroup} The layer group.
   */
  this.getActiveLayerGroup = function () {
    return stage.getActiveLayerGroup();
  };

  /**
   * Get the view layers associated to a data index.
   * The layer are available after the first loaded item.
   *
   * @param {number} index The data index.
   * @returns {Array} The layers.
   */
  this.getViewLayersByDataIndex = function (index) {
    return stage.getViewLayersByDataIndex(index);
  };

  /**
   * Get a layer group by id.
   * The layer is available after the first loaded item.
   *
   * @param {number} groupId The group id.
   * @returns {dwv.gui.LayerGroup} The layer group.
   */
  this.getLayerGroupById = function (groupId) {
    return stage.getLayerGroup(groupId);
  };

  /**
   * Get the number of layer groups.
   *
   * @returns {number} The number of groups.
   */
  this.getNumberOfLayerGroups = function () {
    return stage.getNumberOfLayerGroups();
  };

  /**
   * Get the app style.
   *
   * @returns {object} The app style.
   */
  this.getStyle = function () {
    return style;
  };

  /**
   * Add a command to the undo stack.
   *
   * @param {object} cmd The command to add.
   * @fires dwv.tool.UndoStack#undoadd
   */
  this.addToUndoStack = function (cmd) {
    if (undoStack !== null) {
      undoStack.add(cmd);
    }
  };

  /**
   * Initialise the application.
   *
   * @param {object} opt The application option with:
   * - `dataViewConfigs`: data indexed object containing the data view
   *   configurations in the form of a list of objects containing:
   *   - divId: the HTML div id
   *   - orientation: optional 'axial', 'coronal' or 'sagittal' orientation
   *     string (default undefined keeps the original slice order)
   * - `binders`: array of layerGroup binders
   * - `tools`: tool name indexed object containing individual tool
   *   configurations
   * - `viewOnFirstLoadItem`: boolean flag to trigger the first data render
   *   after the first loaded data or not
   * - `defaultCharacterSet`: the default chraracter set string used for DICOM
   *   parsing
   */
  this.init = function (opt) {
    // store
    options = opt;
    // defaults
    if (typeof options.viewOnFirstLoadItem === 'undefined') {
      options.viewOnFirstLoadItem = true;
    }

    // undo stack
    undoStack = new dwv.tool.UndoStack();
    undoStack.addEventListener('undoadd', fireEvent);
    undoStack.addEventListener('undo', fireEvent);
    undoStack.addEventListener('redo', fireEvent);

    // tools
    if (options.tools && options.tools.length !== 0) {
      // setup the tool list
      var toolList = {};
      var keys = Object.keys(options.tools);
      for (var t = 0; t < keys.length; ++t) {
        var toolName = keys[t];
        var toolParams = options.tools[toolName];
        // find the tool in the dwv.tool namespace
        if (typeof dwv.tool[toolName] !== 'undefined') {
          // create tool instance
          toolList[toolName] = new dwv.tool[toolName](this);
          // register listeners
          if (typeof toolList[toolName].addEventListener !== 'undefined') {
            if (typeof toolParams.events !== 'undefined') {
              for (var j = 0; j < toolParams.events.length; ++j) {
                var eventName = toolParams.events[j];
                toolList[toolName].addEventListener(eventName, fireEvent);
              }
            }
          }
          // tool options
          if (typeof toolParams.options !== 'undefined') {
            var type = 'raw';
            if (typeof toolParams.type !== 'undefined') {
              type = toolParams.type;
            }
            var toolOptions = toolParams.options;
            if (type === 'instance' ||
                type === 'factory') {
              toolOptions = {};
              for (var i = 0; i < toolParams.options.length; ++i) {
                var optionName = toolParams.options[i];
                var optionClassName = optionName;
                if (type === 'factory') {
                  optionClassName += 'Factory';
                }
                var toolNamespace = toolName.charAt(0).toLowerCase() +
                  toolName.slice(1);
                if (typeof dwv.tool[toolNamespace][optionClassName] !==
                  'undefined') {
                  toolOptions[optionName] =
                    dwv.tool[toolNamespace][optionClassName];
                } else {
                  dwv.logger.warn('Could not find option class for: ' +
                    optionName);
                }
              }
            }
            toolList[toolName].setOptions(toolOptions);
          }
        } else {
          dwv.logger.warn('Could not initialise unknown tool: ' + toolName);
        }
      }
      // add tools to the controller
      toolboxController = new dwv.ctrl.ToolboxController(toolList);
    }

    // create load controller
    loadController = new dwv.ctrl.LoadController(options.defaultCharacterSet);
    loadController.onloadstart = onloadstart;
    loadController.onprogress = onprogress;
    loadController.onloaditem = onloaditem;
    loadController.onload = onload;
    loadController.onloadend = onloadend;
    loadController.onerror = onerror;
    loadController.onabort = onabort;

    // create data controller
    dataController = new dwv.ctrl.DataController();
    // create stage
    stage = new dwv.gui.Stage();
    if (typeof options.binders !== 'undefined') {
      stage.setBinders(options.binders);
    }
  };

  /**
   * Get a HTML element associated to the application.
   *
   * @param {string} _name The name or id to find.
   * @returns {object} The found element or null.
   * @deprecated
   */
  this.getElement = function (_name) {
    return null;
  };

  /**
   * Reset the application.
   */
  this.reset = function () {
    // clear objects
    dataController.reset();
    stage.empty();
    // reset undo/redo
    if (undoStack) {
      undoStack = new dwv.tool.UndoStack();
      undoStack.addEventListener('undoadd', fireEvent);
      undoStack.addEventListener('undo', fireEvent);
      undoStack.addEventListener('redo', fireEvent);
    }
  };

  /**
   * Reset the layout of the application.
   */
  this.resetLayout = function () {
    stage.reset();
    stage.draw();
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

  // load API [begin] -------------------------------------------------------

  /**
   * Load a list of files. Can be image files or a state file.
   *
   * @param {Array} files The list of files to load.
   * @fires dwv.App#loadstart
   * @fires dwv.App#loadprogress
   * @fires dwv.App#loaditem
   * @fires dwv.App#loadend
   * @fires dwv.App#error
   * @fires dwv.App#abort
   */
  this.loadFiles = function (files) {
    if (files.length === 0) {
      dwv.logger.warn('Ignoring empty input file list.');
      return;
    }
    loadController.loadFiles(files);
  };

  /**
   * Load a list of URLs. Can be image files or a state file.
   *
   * @param {Array} urls The list of urls to load.
   * @param {object} options The options object, can contain:
   *  - requestHeaders: an array of {name, value} to use as request headers
   *  - withCredentials: boolean xhr.withCredentials flag to pass to the request
   *  - batchSize: the size of the request url batch
   * @fires dwv.App#loadstart
   * @fires dwv.App#loadprogress
   * @fires dwv.App#loaditem
   * @fires dwv.App#loadend
   * @fires dwv.App#error
   * @fires dwv.App#abort
   */
  this.loadURLs = function (urls, options) {
    if (urls.length === 0) {
      dwv.logger.warn('Ignoring empty input url list.');
      return;
    }
    loadController.loadURLs(urls, options);
  };

  /**
   * Load a list of ArrayBuffers.
   *
   * @param {Array} data The list of ArrayBuffers to load
   *   in the form of [{name: "", filename: "", data: data}].
   * @fires dwv.App#loadstart
   * @fires dwv.App#loadprogress
   * @fires dwv.App#loaditem
   * @fires dwv.App#loadend
   * @fires dwv.App#error
   * @fires dwv.App#abort
   */
  this.loadImageObject = function (data) {
    loadController.loadImageObject(data);
  };

  /**
   * Abort the current load.
   */
  this.abortLoad = function () {
    loadController.abort();
  };

  // load API [end] ---------------------------------------------------------

  /**
   * Fit the display to the data of each layer group.
   * To be called once the image is loaded.
   */
  this.fitToContainer = function () {
    for (var i = 0; i < stage.getNumberOfLayerGroups(); ++i) {
      var layerGroup = stage.getLayerGroup(i);
      layerGroup.fitToContainer();
      layerGroup.draw();
    }
  };

  /**
   * Init the Window/Level display
   */
  this.initWLDisplay = function () {
    var viewLayer = stage.getActiveLayerGroup().getActiveViewLayer();
    var controller = viewLayer.getViewController();
    controller.initialise();
  };

  /**
   * Get the layer group configuration from a data index.
   * Defaults to div id 'layerGroup' if no association object has been set.
   *
   * @param {number} dataIndex The data index.
   * @returns {Array} The list of associated configs.
   */
  function getViewConfigs(dataIndex) {
    // check options
    if (options.dataViewConfigs === null ||
      typeof options.dataViewConfigs === 'undefined') {
      throw new Error('No available data view configuration');
    }
    var configs = [];
    if (typeof options.dataViewConfigs['*'] !== 'undefined') {
      configs = options.dataViewConfigs['*'];
    } else if (typeof options.dataViewConfigs[dataIndex] !== 'undefined') {
      configs = options.dataViewConfigs[dataIndex];
    }
    return configs;
  }

  /**
   * Get the data view config.
   * Carefull, returns a reference, do not modify without resetting.
   *
   * @returns {object} The configuration list.
   */
  this.getDataViewConfig = function () {
    return options.dataViewConfigs;
  };

  /**
   * Set the data view configuration (see the init options for details).
   *
   * @param {object} configs The configuration list.
   */
  this.setDataViewConfig = function (configs) {
    // clean up
    stage.empty();
    // set new
    options.dataViewConfigs = configs;
    // create layer groups
    createLayerGroups(configs);
  };

  /**
   * Create layer groups according to a data view config:
   * adds them to stage and bind them.
   *
   * @param {object} dataViewConfigs The data view config.
   */
  function createLayerGroups(dataViewConfigs) {
    var dataKeys = Object.keys(dataViewConfigs);
    var divIds = [];
    for (var i = 0; i < dataKeys.length; ++i) {
      var dataConfigs = dataViewConfigs[dataKeys[i]];
      for (var j = 0; j < dataConfigs.length; ++j) {
        var viewConfig = dataConfigs[j];
        // view configs can contain the same divIds, avoid duplicating
        if (!divIds.includes(viewConfig.divId)) {
          // create new layer group
          var element = document.getElementById(viewConfig.divId);
          var layerGroup = stage.addLayerGroup(element);
          // bind events
          bindLayerGroupToApp(layerGroup);
          // optional orientation
          if (typeof viewConfig.orientation !== 'undefined') {
            layerGroup.setTargetOrientation(
              dwv.math.getMatrixFromName(viewConfig.orientation));
          }
          divIds.push(viewConfig.divId);
        }
      }
    }
  }

  /**
   * Set the layer groups binders.
   *
   * @param {Array} list The binders list.
   */
  this.setLayerGroupsBinders = function (list) {
    stage.setBinders(list);
  };

  /**
   * Render the current data.
   *
   * @param {number} dataIndex The data index to render.
   */
  this.render = function (dataIndex) {
    if (typeof dataIndex === 'undefined' || dataIndex === null) {
      throw new Error('Cannot render without data index');
    }

    // create layer groups if not done yet
    // (create all to allow for ratio sync)
    if (stage.getNumberOfLayerGroups() === 0) {
      createLayerGroups(options.dataViewConfigs);
    }

    // loop on all configs
    var viewConfigs = getViewConfigs(dataIndex);
    // nothing to do if no view config
    if (viewConfigs.length === 0) {
      dwv.logger.info('Not rendering data: ' + dataIndex +
        ' (no data view config)');
      return;
    }
    for (var i = 0; i < viewConfigs.length; ++i) {
      var config = viewConfigs[i];
      var layerGroup =
        stage.getLayerGroupWithElementId(config.divId);
      // layer group must exist
      if (!layerGroup) {
        throw new Error('No layer group for ' + config.divId);
      }
      // initialise or add view
      // warn: needs a loaded DOM
      if (layerGroup.getViewLayersByDataIndex(dataIndex).length === 0) {
        if (layerGroup.getNumberOfLayers() === 0) {
          initialiseBaseLayers(dataIndex, config);
        } else {
          addViewLayer(dataIndex, config);
        }
      }
      // draw
      layerGroup.draw();
    }
  };

  /**
   * Zoom to the layers.
   *
   * @param {number} step The step to add to the current zoom.
   * @param {number} cx The zoom center X coordinate.
   * @param {number} cy The zoom center Y coordinate.
   */
  this.zoom = function (step, cx, cy) {
    var layerGroup = stage.getActiveLayerGroup();
    var viewController = layerGroup.getActiveViewLayer().getViewController();
    var k = viewController.getCurrentScrollPosition();
    var center = new dwv.math.Point3D(cx, cy, k);
    layerGroup.addScale(step, center);
    layerGroup.draw();
  };

  /**
   * Apply a translation to the layers.
   *
   * @param {number} tx The translation along X.
   * @param {number} ty The translation along Y.
   */
  this.translate = function (tx, ty) {
    var layerGroup = stage.getActiveLayerGroup();
    layerGroup.addTranslation({x: tx, y: ty});
    layerGroup.draw();
  };

  /**
   * Set the image layer opacity.
   *
   * @param {number} alpha The opacity ([0:1] range).
   */
  this.setOpacity = function (alpha) {
    var viewLayer = stage.getActiveLayerGroup().getActiveViewLayer();
    viewLayer.setOpacity(alpha);
    viewLayer.draw();
  };

  /**
   * Get the list of drawing display details.
   *
   * @returns {object} The list of draw details including id, position...
   */
  this.getDrawDisplayDetails = function () {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    return drawController.getDrawDisplayDetails();
  };

  /**
   * Get a list of drawing store details.
   *
   * @returns {object} A list of draw details including id, text, quant...
   */
  this.getDrawStoreDetails = function () {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    return drawController.getDrawStoreDetails();
  };
  /**
   * Set the drawings on the current stage.
   *
   * @param {Array} drawings An array of drawings.
   * @param {Array} drawingsDetails An array of drawings details.
   */
  this.setDrawings = function (drawings, drawingsDetails) {
    var layerGroup = stage.getActiveLayerGroup();
    var viewController =
      layerGroup.getActiveViewLayer().getViewController();
    var drawController =
      layerGroup.getActiveDrawLayer().getDrawController();

    drawController.setDrawings(
      drawings, drawingsDetails, fireEvent, this.addToUndoStack);

    drawController.activateDrawLayer(
      viewController.getCurrentOrientedIndex(),
      viewController.getScrollIndex());
  };
  /**
   * Update a drawing from its details.
   *
   * @param {object} drawDetails Details of the drawing to update.
   */
  this.updateDraw = function (drawDetails) {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    drawController.updateDraw(drawDetails);
  };
  /**
   * Delete all Draws from all layers.
   */
  this.deleteDraws = function () {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    drawController.deleteDraws(fireEvent, this.addToUndoStack);
  };
  /**
   * Check the visibility of a given group.
   *
   * @param {object} drawDetails Details of the drawing to check.
   * @returns {boolean} True if the group is visible.
   */
  this.isGroupVisible = function (drawDetails) {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    return drawController.isGroupVisible(drawDetails);
  };
  /**
   * Toggle group visibility.
   *
   * @param {object} drawDetails Details of the drawing to update.
   */
  this.toogleGroupVisibility = function (drawDetails) {
    var drawController =
      stage.getActiveLayerGroup().getActiveDrawLayer().getDrawController();
    drawController.toogleGroupVisibility(drawDetails);
  };

  /**
   * Get the JSON state of the app.
   *
   * @returns {object} The state of the app as a JSON object.
   */
  this.getState = function () {
    var state = new dwv.io.State();
    return state.toJSON(self);
  };

  // Handler Methods -----------------------------------------------------------

  /**
   * Handle resize: fit the display to the window.
   * To be called once the image is loaded.
   * Can be connected to a window 'resize' event.
   *
   * @param {object} _event The change event.
   * @private
   */
  this.onResize = function (_event) {
    self.fitToContainer();
  };

  /**
   * Key down callback. Meant to be used in tools.
   *
   * @param {object} event The key down event.
   * @fires dwv.App#keydown
   */
  this.onKeydown = function (event) {
    /**
     * Key down event.
     *
     * @event dwv.App#keydown
     * @type {KeyboardEvent}
     * @property {string} type The event type: keydown.
     * @property {string} context The tool where the event originated.
     */
    fireEvent(event);
  };

  /**
   * Key down event handler example.
   * - CRTL-Z: undo
   * - CRTL-Y: redo
   * - CRTL-ARROW_LEFT: next element on fourth dim
   * - CRTL-ARROW_UP: next element on third dim
   * - CRTL-ARROW_RIGHT: previous element on fourth dim
   * - CRTL-ARROW_DOWN: previous element on third dim
   *
   * @param {object} event The key down event.
   * @fires dwv.tool.UndoStack#undo
   * @fires dwv.tool.UndoStack#redo
   */
  this.defaultOnKeydown = function (event) {
    var viewController =
      stage.getActiveLayerGroup().getActiveViewLayer().getViewController();
    var size = viewController.getImageSize();
    if (event.ctrlKey) {
      if (event.keyCode === 37) { // crtl-arrow-left
        event.preventDefault();
        if (size.moreThanOne(3)) {
          viewController.decrementIndex(3);
        }
      } else if (event.keyCode === 38) { // crtl-arrow-up
        event.preventDefault();
        if (viewController.canScroll()) {
          viewController.incrementScrollIndex();
        }
      } else if (event.keyCode === 39) { // crtl-arrow-right
        event.preventDefault();
        if (size.moreThanOne(3)) {
          viewController.incrementIndex(3);
        }
      } else if (event.keyCode === 40) { // crtl-arrow-down
        event.preventDefault();
        if (viewController.canScroll()) {
          viewController.decrementScrollIndex();
        }
      } else if (event.keyCode === 89) { // crtl-y
        undoStack.redo();
      } else if (event.keyCode === 90) { // crtl-z
        undoStack.undo();
      }
    }
  };

  // Internal members shortcuts-----------------------------------------------

  /**
   * Reset the display
   */
  this.resetDisplay = function () {
    self.resetLayout();
    self.initWLDisplay();
  };

  /**
   * Reset the app zoom.s
   */
  this.resetZoom = function () {
    self.resetLayout();
  };

  /**
   * Set the colour map.
   *
   * @param {string} colourMap The colour map name.
   */
  this.setColourMap = function (colourMap) {
    var viewController =
      stage.getActiveLayerGroup().getActiveViewLayer().getViewController();
    viewController.setColourMapFromName(colourMap);
  };

  /**
   * Set the window/level preset.
   *
   * @param {object} preset The window/level preset.
   */
  this.setWindowLevelPreset = function (preset) {
    var viewController =
      stage.getActiveLayerGroup().getActiveViewLayer().getViewController();
    viewController.setWindowLevelPreset(preset);
  };

  /**
   * Set the tool
   *
   * @param {string} tool The tool.
   */
  this.setTool = function (tool) {
    // bind tool to layer: not really important which layer since
    //   tools are responsible for finding the event source layer
    //   but there needs to be at least one binding...
    for (var i = 0; i < stage.getNumberOfLayerGroups(); ++i) {
      var layerGroup = stage.getLayerGroup(i);
      // unbind previous layer
      var vl = layerGroup.getActiveViewLayer();
      if (vl) {
        toolboxController.unbindLayer(vl);
      }
      var dl = layerGroup.getActiveDrawLayer();
      if (dl) {
        toolboxController.unbindLayer(dl);
      }
      // bind new layer
      var layer = null;
      if (tool === 'Draw' ||
        tool === 'Livewire' ||
        tool === 'Floodfill') {
        layer = layerGroup.getActiveDrawLayer();
      } else {
        layer = layerGroup.getActiveViewLayer();
      }
      if (layer) {
        toolboxController.bindLayer(layer);
      }
    }

    // set toolbox tool
    toolboxController.setSelectedTool(tool);
  };

  /**
   * Set the draw shape.
   *
   * @param {string} shape The draw shape.
   */
  this.setDrawShape = function (shape) {
    toolboxController.setSelectedShape(shape);
  };

  /**
   * Set the image filter
   *
   * @param {string} filter The image filter.
   */
  this.setImageFilter = function (filter) {
    toolboxController.setSelectedFilter(filter);
  };

  /**
   * Run the selected image filter.
   */
  this.runImageFilter = function () {
    toolboxController.runSelectedFilter();
  };

  /**
   * Set the draw line colour.
   *
   * @param {string} colour The line colour.
   */
  this.setDrawLineColour = function (colour) {
    toolboxController.setLineColour(colour);
  };

  /**
   * Set the filter min/max.
   *
   * @param {object} range The new range of the data: {min:a, max:b}.
   */
  this.setFilterMinMax = function (range) {
    toolboxController.setRange(range);
  };

  /**
   * Undo the last action
   *
   * @fires dwv.tool.UndoStack#undo
   */
  this.undo = function () {
    undoStack.undo();
  };

  /**
   * Redo the last action
   *
   * @fires dwv.tool.UndoStack#redo
   */
  this.redo = function () {
    undoStack.redo();
  };


  // Private Methods -----------------------------------------------------------

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  function fireEvent(event) {
    listenerHandler.fireEvent(event);
  }

  /**
   * Data load start callback.
   *
   * @param {object} event The load start event.
   * @private
   */
  function onloadstart(event) {
    /**
     * Load start event.
     *
     * @event dwv.App#loadstart
     * @type {object}
     * @property {string} type The event type: loadstart.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     */
    event.type = 'loadstart';
    fireEvent(event);
  }

  /**
   * Data load progress callback.
   *
   * @param {object} event The progress event.
   * @private
   */
  function onprogress(event) {
    /**
     * Load progress event.
     *
     * @event dwv.App#loadprogress
     * @type {object}
     * @property {string} type The event type: loadprogress.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     * @property {number} loaded The loaded percentage.
     * @property {number} total The total percentage.
     */
    event.type = 'loadprogress';
    fireEvent(event);
  }

  /**
   * Data load callback.
   *
   * @param {object} event The load event.
   * @private
   */
  function onloaditem(event) {
    // check event
    if (typeof event.data === 'undefined') {
      dwv.logger.error('Missing loaditem event data.');
    }
    if (typeof event.loadtype === 'undefined') {
      dwv.logger.error('Missing loaditem event load type.');
    }

    var isFirstLoadItem = event.isfirstitem;

    var eventMetaData = null;
    if (event.loadtype === 'image') {
      if (isFirstLoadItem) {
        dataController.addNew(
          event.loadid, event.data.image, event.data.info);
      } else {
        dataController.update(
          event.loadid, event.data.image, event.data.info);
      }
      eventMetaData = event.data.info;
    } else if (event.loadtype === 'state') {
      var state = new dwv.io.State();
      state.apply(self, state.fromJSON(event.data));
      eventMetaData = 'state';
    }

    /**
     * Load item event: fired when a load item is successfull.
     *
     * @event dwv.App#loaditem
     * @type {object}
     * @property {string} type The event type: loaditem.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     * @property {object} data The loaded meta data.
     */
    fireEvent({
      type: 'loaditem',
      data: eventMetaData,
      source: event.source,
      loadtype: event.loadtype,
      loadid: event.loadid,
      isfirstitem: event.isfirstitem
    });

    // render if first and flag allows
    if (event.loadtype === 'image' &&
      getViewConfigs(event.loadid).length !== 0 &&
      isFirstLoadItem && options.viewOnFirstLoadItem) {
      self.render(event.loadid);
    }
  }

  /**
   * Data load callback.
   *
   * @param {object} event The load event.
   * @private
   */
  function onload(event) {
    /**
     * Load event: fired when a load finishes successfully.
     *
     * @event dwv.App#load
     * @type {object}
     * @property {string} type The event type: load.
     * @property {string} loadType The load type: image or state.
     */
    event.type = 'load';
    fireEvent(event);
  }

  /**
   * Data load end callback.
   *
   * @param {object} event The load end event.
   * @private
   */
  function onloadend(event) {
    /**
     * Main load end event: fired when the load finishes,
     *   successfully or not.
     *
     * @event dwv.App#loadend
     * @type {object}
     * @property {string} type The event type: loadend.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     */
    event.type = 'loadend';
    fireEvent(event);
  }

  /**
   * Data load error callback.
   *
   * @param {object} event The error event.
   * @private
   */
  function onerror(event) {
    /**
     * Load error event.
     *
     * @event dwv.App#error
     * @type {object}
     * @property {string} type The event type: error.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     * @property {object} error The error.
     * @property {object} target The event target.
     */
    event.type = 'error';
    fireEvent(event);
  }

  /**
   * Data load abort callback.
   *
   * @param {object} event The abort event.
   * @private
   */
  function onabort(event) {
    /**
     * Load abort event.
     *
     * @event dwv.App#abort
     * @type {object}
     * @property {string} type The event type: abort.
     * @property {string} loadType The load type: image or state.
     * @property {*} source The load source: string for an url,
     *   File for a file.
     */
    event.type = 'abort';
    fireEvent(event);
  }

  /**
   * Bind layer group events to app.
   *
   * @param {object} group The layer group.
   * @private
   */
  function bindLayerGroupToApp(group) {
    // propagate layer group events
    group.addEventListener('zoomchange', fireEvent);
    group.addEventListener('offsetchange', fireEvent);
    // propagate viewLayer events
    group.addEventListener('renderstart', fireEvent);
    group.addEventListener('renderend', fireEvent);
    // propagate view events
    for (var j = 0; j < dwv.image.viewEventNames.length; ++j) {
      group.addEventListener(dwv.image.viewEventNames[j], fireEvent);
    }
  }

  /**
   * Initialise the layers.
   * To be called once the DICOM data has been loaded.
   *
   * @param {number} dataIndex The data index.
   * @param {object} dataViewConfig The data view config.
   * @private
   */
  function initialiseBaseLayers(dataIndex, dataViewConfig) {
    // add layers
    addViewLayer(dataIndex, dataViewConfig);

    // initialise the toolbox
    if (toolboxController) {
      toolboxController.init();
    }
  }

  /**
   * Add a view layer.
   *
   * @param {number} dataIndex The data index.
   * @param {object} dataViewConfig The data view config.
   */
  function addViewLayer(dataIndex, dataViewConfig) {
    var data = dataController.get(dataIndex);
    if (!data) {
      throw new Error('Cannot initialise layer with data id: ' + dataIndex);
    }
    var layerGroup = stage.getLayerGroupWithElementId(dataViewConfig.divId);
    if (!layerGroup) {
      throw new Error('Cannot initialise layer with group id: ' +
        dataViewConfig.divId);
    }
    var imageGeometry = data.image.getGeometry();

    // un-bind
    stage.unbindLayerGroups();

    // create and setup view
    var viewFactory = new dwv.ViewFactory();
    var view = viewFactory.create(
      new dwv.dicom.DicomElementsWrapper(data.meta),
      data.image);
    var viewOrientation = dwv.gui.getViewOrientation(
      imageGeometry.getOrientation(),
      layerGroup.getTargetOrientation()
    );
    view.setOrientation(viewOrientation);

    // make pixel of value 0 transparent for segmentation
    // (assuming RGB data)
    if (data.image.getMeta().Modality === 'SEG') {
      view.setAlphaFunction(function (value) {
        if (value[0] === 0 &&
          value[1] === 0 &&
          value[2] === 0) {
          return 1;
        } else {
          return 0xff;
        }
      });
    }

    // colour map
    if (typeof dataViewConfig.colourMap !== 'undefined') {
      view.setColourMap(dataViewConfig.colourMap);
    }

    // opacity
    var opacity = 1;
    // do we have more than one layer
    // (the layer has not been added to the layer group yet)
    if (layerGroup.getNumberOfLayers() !== 0) {
      opacity = 0.5;
      // set color map if non was provided
      if (typeof dataViewConfig.colourMap === 'undefined') {
        view.setColourMap(dwv.image.lut.rainbow);
      }
    }

    // view layer
    var viewLayer = layerGroup.addViewLayer();
    viewLayer.setView(view);
    var size2D = imageGeometry.getSize(viewOrientation).get2D();
    var spacing2D = imageGeometry.getSpacing(viewOrientation).get2D();
    viewLayer.initialise(size2D, spacing2D, dataIndex, opacity);
    viewLayer.setScale(layerGroup.getScale());
    viewLayer.setOffset(layerGroup.getOffset());

    // listen to image changes
    dataController.addEventListener('imagechange', viewLayer.onimagechange);

    // bind
    stage.bindLayerGroups();

    // optional draw layer
    if (toolboxController && toolboxController.hasTool('Draw')) {
      var dl = layerGroup.addDrawLayer();
      dl.initialise(size2D, spacing2D, dataIndex);
      dl.setPlaneHelper(viewLayer.getViewController().getPlaneHelper());

      // force positionchange to sync layers
      var vc = viewLayer.getViewController();
      var value = [
        vc.getCurrentIndex().getValues(),
        vc.getCurrentPosition().getValues()
      ];
      layerGroup.updateLayersToPositionChange({
        value: value,
        srclayerid: viewLayer.getId()
      });
    }

    // sync layer groups
    stage.syncLayerGroupScale();
  }

};
