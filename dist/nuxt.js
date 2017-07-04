module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 27);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = require("lodash");

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony export (immutable) */ __webpack_exports__["encodeHtml"] = encodeHtml;
/* harmony export (immutable) */ __webpack_exports__["getContext"] = getContext;
/* harmony export (immutable) */ __webpack_exports__["setAnsiColors"] = setAnsiColors;
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "waitFor", function() { return waitFor; });
/* harmony export (immutable) */ __webpack_exports__["urlJoin"] = urlJoin;
/* harmony export (immutable) */ __webpack_exports__["isUrl"] = isUrl;
/* harmony export (immutable) */ __webpack_exports__["promisifyRoute"] = promisifyRoute;
/* harmony export (immutable) */ __webpack_exports__["sequence"] = sequence;
/* harmony export (immutable) */ __webpack_exports__["chainFn"] = chainFn;
/* harmony export (immutable) */ __webpack_exports__["wp"] = wp;
/* harmony export (immutable) */ __webpack_exports__["r"] = r;
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_array_from__ = __webpack_require__(33);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_array_from___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_array_from__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_lodash__);









function encodeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getContext(req, res) {
  return { req: req, res: res };
}

function setAnsiColors(ansiHTML) {
  ansiHTML.setColors({
    reset: ['efefef', 'a6004c'],
    darkgrey: '5a012b',
    yellow: 'ffab07',
    green: 'aeefba',
    magenta: 'ff84bf',
    blue: '3505a0',
    cyan: '56eaec',
    red: '4e053a'
  });
}

var waitFor = function () {
  var _ref = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee(ms) {
    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            return _context.abrupt('return', new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve) {
              setTimeout(resolve, ms || 0);
            }));

          case 1:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function waitFor(_x) {
    return _ref.apply(this, arguments);
  };
}();

function urlJoin() {
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/').replace(':/', '://');
}

function isUrl(url) {
  return url.indexOf('http') === 0 || url.indexOf('//') === 0;
}

function promisifyRoute(fn) {
  // If routes is an array
  if (Array.isArray(fn)) {
    return __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a.resolve(fn);
  }
  // If routes is a function expecting a callback
  if (fn.length === 1) {
    return new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
      fn(function (err, routeParams) {
        if (err) {
          reject(err);
        }
        resolve(routeParams);
      });
    });
  }
  var promise = fn();
  if (!promise || !(promise instanceof __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a) && typeof promise.then !== 'function') {
    promise = __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a.resolve(promise);
  }
  return promise;
}

function sequence(tasks, fn) {
  return tasks.reduce(function (promise, task) {
    return promise.then(function () {
      return fn(task);
    });
  }, __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a.resolve());
}

function chainFn(base, fn) {
  /* istanbul ignore if */
  if (!(fn instanceof Function)) {
    return;
  }
  return function () {
    if (base instanceof Function) {
      base.apply(this, arguments);
    }
    fn.apply(this, arguments);
  };
}

function wp(p) {
  /* istanbul ignore if */
  if (/^win/.test(process.platform)) {
    p = p.replace(/\\/g, '\\\\');
  }
  return p;
}

var reqSep = /\//g;
var sysSep = __WEBPACK_IMPORTED_MODULE_5_lodash___default.a.escapeRegExp(__WEBPACK_IMPORTED_MODULE_4_path__["sep"]);
var normalize = function normalize(string) {
  return string.replace(reqSep, sysSep);
};

function r() {
  var args = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_array_from___default()(arguments);
  if (__WEBPACK_IMPORTED_MODULE_5_lodash___default.a.last(args).indexOf('~') !== -1) {
    return wp(__WEBPACK_IMPORTED_MODULE_5_lodash___default.a.last(args));
  }
  args = args.map(normalize);
  return wp(__WEBPACK_IMPORTED_MODULE_4_path__["resolve"].apply(null, args));
}

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/core-js/promise");

/***/ }),
/* 4 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/helpers/asyncToGenerator");

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/regenerator");

/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/core-js/json/stringify");

/***/ }),
/* 7 */
/***/ (function(module, exports) {

module.exports = require("debug");

/***/ }),
/* 8 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/helpers/classCallCheck");

/***/ }),
/* 9 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/helpers/createClass");

/***/ }),
/* 10 */
/***/ (function(module, exports) {

module.exports = require("fs-extra");

/***/ }),
/* 11 */
/***/ (function(module, exports) {

module.exports = require("pify");

/***/ }),
/* 12 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/core-js/object/assign");

/***/ }),
/* 13 */
/***/ (function(module, exports) {

module.exports = require("webpack");

/***/ }),
/* 14 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__vue_loader_config__ = __webpack_require__(30);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__utils__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__helpers__ = __webpack_require__(15);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_extract_text_webpack_plugin__ = __webpack_require__(17);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_extract_text_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_extract_text_webpack_plugin__);









/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
/* harmony default export */ __webpack_exports__["a"] = (function (_ref) {
  var isClient = _ref.isClient,
      isServer = _ref.isServer;

  var nodeModulesDir = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(__dirname, '..', 'node_modules');
  var config = {
    devtool: this.dev ? 'cheap-module-source-map' : false,
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta']
    },
    output: {
      publicPath: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_3__utils__["isUrl"])(this.options.build.publicPath) ? this.options.build.publicPath : __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_3__utils__["urlJoin"])(this.options.router.base, this.options.build.publicPath)
    },
    performance: {
      maxEntrypointSize: 300000,
      maxAssetSize: 300000,
      hints: this.dev ? false : 'warning'
    },
    resolve: {
      extensions: ['.js', '.json', '.vue', '.ts'],
      // Disable for now
      alias: {
        '~': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir),
        'static': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'static'), // use in template with <img src="~static/nuxt.png" />
        '~static': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'static'),
        'assets': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'assets'), // use in template with <img src="~assets/nuxt.png" />
        '~assets': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'assets'),
        '~plugins': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'plugins'),
        '~store': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.buildDir, 'store'),
        '~router': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.buildDir, 'router'),
        '~pages': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'pages'),
        '~components': __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.srcDir, 'components')
      },
      modules: [__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.dir, 'node_modules'), nodeModulesDir]
    },
    resolveLoader: {
      modules: [__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_2_path__["join"])(this.dir, 'node_modules'), nodeModulesDir]
    },
    module: {
      rules: [{
        test: /\.vue$/,
        loader: 'vue-loader',
        query: __WEBPACK_IMPORTED_MODULE_0__vue_loader_config__["a" /* default */].call(this, { isClient: isClient, isServer: isServer })
      }, {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1_lodash__["defaults"])(this.options.build.babel, {
          presets: ['vue-app'],
          babelrc: false,
          cacheDirectory: !!this.dev
        })
      }, { test: /\.css$/, use: __WEBPACK_IMPORTED_MODULE_4__helpers__["a" /* styleLoader */].call(this, 'css') }, { test: /\.less$/, use: __WEBPACK_IMPORTED_MODULE_4__helpers__["a" /* styleLoader */].call(this, 'less', 'less-loader') }, { test: /\.sass$/, use: __WEBPACK_IMPORTED_MODULE_4__helpers__["a" /* styleLoader */].call(this, 'sass', 'sass-loader?indentedSyntax&sourceMap') }, { test: /\.scss$/, use: __WEBPACK_IMPORTED_MODULE_4__helpers__["a" /* styleLoader */].call(this, 'sass', 'sass-loader?sourceMap') }, { test: /\.styl(us)?$/, use: __WEBPACK_IMPORTED_MODULE_4__helpers__["a" /* styleLoader */].call(this, 'stylus', 'stylus-loader') }]
    },
    plugins: this.options.build.plugins
    // CSS extraction
  };if (__WEBPACK_IMPORTED_MODULE_4__helpers__["b" /* extractStyles */].call(this)) {
    config.plugins.push(new __WEBPACK_IMPORTED_MODULE_5_extract_text_webpack_plugin___default.a({ filename: this.options.build.filenames.css }));
  }
  // Add nuxt build loaders (can be configured in nuxt.config.js)
  config.module.rules = config.module.rules.concat(this.options.build.loaders);
  // Return config
  return config;
});

/***/ }),
/* 15 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (immutable) */ __webpack_exports__["b"] = extractStyles;
/* harmony export (immutable) */ __webpack_exports__["a"] = styleLoader;
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_extract_text_webpack_plugin__ = __webpack_require__(17);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_extract_text_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_extract_text_webpack_plugin__);


function extractStyles() {
  return !this.dev && this.options.build.extractCSS;
}

function styleLoader(ext) {
  var loader = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (extractStyles.call(this)) {
    return __WEBPACK_IMPORTED_MODULE_0_extract_text_webpack_plugin___default.a.extract({
      use: ['css-loader?minify&sourceMap'].concat(loader),
      fallback: 'vue-style-loader?sourceMap'
    });
  }
  return ['vue-style-loader?sourceMap', 'css-loader?sourceMap'].concat(loader);
}

/***/ }),
/* 16 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/helpers/typeof");

/***/ }),
/* 17 */
/***/ (function(module, exports) {

module.exports = require("extract-text-webpack-plugin");

/***/ }),
/* 18 */
/***/ (function(module, exports) {

module.exports = require("hash-sum");

/***/ }),
/* 19 */
/***/ (function(module, exports) {

module.exports = require("serialize-javascript");

/***/ }),
/* 20 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (immutable) */ __webpack_exports__["a"] = options;
/* harmony export (immutable) */ __webpack_exports__["c"] = production;
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return build; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_chokidar__ = __webpack_require__(35);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_chokidar___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_chokidar__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_fs_extra__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_fs_extra___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_fs_extra__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_hash_sum__ = __webpack_require__(18);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_hash_sum___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_hash_sum__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_pify__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_pify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_pify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_webpack__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_webpack___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_9_webpack__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10_post_compile_webpack_plugin__ = __webpack_require__(48);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10_post_compile_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_10_post_compile_webpack_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11_serialize_javascript__ = __webpack_require__(19);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11_serialize_javascript___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_11_serialize_javascript__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12_vue_server_renderer__ = __webpack_require__(50);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12_vue_server_renderer___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_12_vue_server_renderer__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_13_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14__utils__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_15__webpack_client_config_js__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_16__webpack_server_config_js__ = __webpack_require__(29);







var buildFiles = function () {
  var _ref2 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee2() {
    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (!this.dev) {
              _context2.next = 7;
              break;
            }

            debug('Adding webpack middleware...');
            createWebpackMiddleware.call(this);
            webpackWatchAndUpdate.call(this);
            watchFiles.call(this);
            _context2.next = 13;
            break;

          case 7:
            debug('Building files...');
            _context2.next = 10;
            return webpackRunClient.call(this);

          case 10:
            _context2.next = 12;
            return webpackRunServer.call(this);

          case 12:
            addAppTemplate.call(this);

          case 13:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function buildFiles() {
    return _ref2.apply(this, arguments);
  };
}();

var generateRoutesAndFiles = function () {
  var _ref3 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee4() {
    var _this2 = this;

    var templatesFiles, templateVars, layoutsFiles, files, customTemplateFiles;
    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            debug('Generating files...');
            // -- Templates --
            templatesFiles = ['App.vue', 'client.js', 'index.js', 'middleware.js', 'router.js', 'server.js', 'utils.js', 'components/nuxt-error.vue', 'components/nuxt-loading.vue', 'components/nuxt-child.js', 'components/nuxt-link.js', 'components/nuxt.vue'];
            templateVars = {
              options: this.options,
              uniqBy: __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.uniqBy,
              isDev: this.dev,
              router: {
                mode: this.options.router.mode,
                base: this.options.router.base,
                middleware: this.options.router.middleware,
                linkActiveClass: this.options.router.linkActiveClass,
                linkExactActiveClass: this.options.router.linkExactActiveClass,
                scrollBehavior: this.options.router.scrollBehavior
              },
              env: this.options.env,
              head: this.options.head,
              middleware: __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(this.srcDir, 'middleware')),
              store: this.options.store || __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(this.srcDir, 'store')),
              css: this.options.css,
              plugins: this.options.plugins.map(function (p, i) {
                if (typeof p === 'string') p = { src: p };
                p.src = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(_this2.srcDir, p.src);
                return { src: p.src, ssr: p.ssr !== false, name: 'plugin' + i };
              }),
              appPath: './App.vue',
              layouts: __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({}, this.options.layouts),
              loading: typeof this.options.loading === 'string' ? __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, this.options.loading) : this.options.loading,
              transition: this.options.transition,
              components: {
                ErrorPage: this.options.ErrorPage ? __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.options.ErrorPage) : null
              }

              // -- Layouts --
            };

            if (!__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["resolve"])(this.srcDir, 'layouts'))) {
              _context4.next = 9;
              break;
            }

            _context4.next = 6;
            return glob('layouts/*.vue', { cwd: this.srcDir });

          case 6:
            layoutsFiles = _context4.sent;

            layoutsFiles.forEach(function (file) {
              var name = file.split('/').slice(-1)[0].replace('.vue', '');
              if (name === 'error') return;
              templateVars.layouts[name] = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(_this2.srcDir, file);
            });
            if (layoutsFiles.indexOf('layouts/error.vue') !== -1) {
              templateVars.components.ErrorPage = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'layouts/error.vue');
            }

          case 9:
            if (templateVars.layouts.default) {
              _context4.next = 14;
              break;
            }

            _context4.next = 12;
            return mkdirp(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.buildDir, 'layouts'));

          case 12:
            templatesFiles.push('layouts/default.vue');
            templateVars.layouts.default = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(__dirname, 'app', 'layouts', 'default.vue');

          case 14:

            // -- Routes --
            debug('Generating routes...');
            // If user defined a custom method to create routes

            if (!this._nuxtPages) {
              _context4.next = 22;
              break;
            }

            _context4.next = 18;
            return glob('pages/**/*.vue', { cwd: this.srcDir });

          case 18:
            files = _context4.sent;

            templateVars.router.routes = createRoutes(files, this.srcDir);
            _context4.next = 23;
            break;

          case 22:
            templateVars.router.routes = this.createRoutes(this.srcDir);

          case 23:
            // router.extendRoutes method
            if (typeof this.options.router.extendRoutes === 'function') {
              // let the user extend the routes
              this.options.router.extendRoutes.call(this, templateVars.router.routes || [], __WEBPACK_IMPORTED_MODULE_14__utils__["r"]);
            }
            // Routes for generate command
            this.routes = flatRoutes(templateVars.router.routes || []);

            // -- Store --
            // Add store if needed
            if (this.options.store) {
              templatesFiles.push('store.js');
            }

            // Resolve template files
            customTemplateFiles = this.options.build.templates.map(function (t) {
              return t.dst || __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["basename"])(t.src || t);
            });

            templatesFiles = templatesFiles.map(function (file) {
              // Skip if custom file was already provided in build.templates[]
              if (customTemplateFiles.indexOf(file) !== -1) {
                return;
              }
              // Allow override templates using a file with same name in ${srcDir}/app
              var customPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(_this2.srcDir, 'app', file);
              var customFileExists = __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(customPath);
              return {
                src: customFileExists ? customPath : __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(__dirname, 'app', file),
                dst: file,
                custom: customFileExists
              };
            }).filter(function (i) {
              return !!i;
            });

            // -- Custom templates --
            // Add custom template files
            templatesFiles = templatesFiles.concat(this.options.build.templates.map(function (t) {
              return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({
                src: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(_this2.dir, t.src || t),
                dst: t.dst || __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["basename"])(t.src || t),
                custom: true
              }, t);
            }));

            // Interpret and move template files to .nuxt/
            return _context4.abrupt('return', __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a.all(templatesFiles.map(function () {
              var _ref4 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee3(_ref5) {
                var src = _ref5.src,
                    dst = _ref5.dst,
                    options = _ref5.options,
                    custom = _ref5.custom;
                var fileContent, template, content, path, dateFS;
                return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee3$(_context3) {
                  while (1) {
                    switch (_context3.prev = _context3.next) {
                      case 0:
                        // Add template to watchers
                        _this2.options.build.watch.push(src);
                        // Render template to dst
                        _context3.next = 3;
                        return readFile(src, 'utf8');

                      case 3:
                        fileContent = _context3.sent;
                        template = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.template(fileContent, {
                          imports: {
                            serialize: __WEBPACK_IMPORTED_MODULE_11_serialize_javascript___default.a,
                            hash: __WEBPACK_IMPORTED_MODULE_7_hash_sum___default.a,
                            r: __WEBPACK_IMPORTED_MODULE_14__utils__["r"],
                            wp: __WEBPACK_IMPORTED_MODULE_14__utils__["wp"]
                          }
                        });
                        content = template(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({}, templateVars, {
                          options: options || {},
                          custom: custom,
                          src: src,
                          dst: dst
                        }));
                        path = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(_this2.buildDir, dst);
                        // Ensure parent dir exits

                        _context3.next = 9;
                        return mkdirp(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["dirname"])(path));

                      case 9:
                        _context3.next = 11;
                        return writeFile(path, content, 'utf8');

                      case 11:
                        // Fix webpack loop (https://github.com/webpack/watchpack/issues/25#issuecomment-287789288)
                        dateFS = Date.now() / 1000 - 30;
                        return _context3.abrupt('return', utimes(path, dateFS, dateFS));

                      case 13:
                      case 'end':
                        return _context3.stop();
                    }
                  }
                }, _callee3, _this2);
              }));

              return function (_x) {
                return _ref4.apply(this, arguments);
              };
            }())));

          case 30:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  return function generateRoutesAndFiles() {
    return _ref3.apply(this, arguments);
  };
}();














var debug = __webpack_require__(7)('nuxt:build');
var remove = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.remove);
var readFile = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.readFile);
var utimes = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.utimes);
var writeFile = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.writeFile);
var mkdirp = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.mkdirp);
var glob = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__webpack_require__(41));

var webpackStats = 'none';
debug.color = 2; // force green color

var defaults = {
  analyze: false,
  extractCSS: false,
  publicPath: '/_nuxt/',
  filenames: {
    css: 'common.[chunkhash].css',
    manifest: 'manifest.[hash].js',
    vendor: 'vendor.bundle.[chunkhash].js',
    app: 'nuxt.bundle.[chunkhash].js'
  },
  vendor: [],
  loaders: [],
  plugins: [],
  babel: {},
  postcss: [],
  templates: [],
  watch: []
};
var defaultsLoaders = [{
  test: /\.(png|jpe?g|gif|svg)$/,
  loader: 'url-loader',
  query: {
    limit: 1000, // 1KO
    name: 'img/[name].[hash:7].[ext]'
  }
}, {
  test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
  loader: 'url-loader',
  query: {
    limit: 1000, // 1 KO
    name: 'fonts/[name].[hash:7].[ext]'
  }
}];
var defaultsPostcss = [__webpack_require__(32)({
  browsers: ['last 3 versions']
})];

function options() {
  // Defaults build options
  var extraDefaults = {};
  if (this.options.build && !Array.isArray(this.options.build.loaders)) extraDefaults.loaders = defaultsLoaders;
  if (this.options.build && !Array.isArray(this.options.build.postcss)) extraDefaults.postcss = defaultsPostcss;
  this.options.build = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.defaultsDeep(this.options.build, defaults, extraDefaults);
  /* istanbul ignore if */
  if (this.dev && __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["isUrl"])(this.options.build.publicPath)) {
    this.options.build.publicPath = defaults.publicPath;
  }
}

function production() {
  // Production, create server-renderer
  webpackStats = {
    chunks: false,
    children: false,
    modules: false,
    colors: true
  };
  var serverConfig = getWebpackServerConfig.call(this);
  var bundlePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'server-bundle.json');
  var manifestPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'client-manifest.json');
  if (__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(bundlePath) && __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(manifestPath)) {
    var bundle = __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.readFileSync(bundlePath, 'utf8');
    var manifest = __WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.readFileSync(manifestPath, 'utf8');
    createRenderer.call(this, JSON.parse(bundle), JSON.parse(manifest));
    addAppTemplate.call(this);
  }
}

var build = function () {
  var _ref = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee() {
    var _this = this;

    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!this._buildDone) {
              _context.next = 2;
              break;
            }

            return _context.abrupt('return', this);

          case 2:
            if (!this._building) {
              _context.next = 4;
              break;
            }

            return _context.abrupt('return', new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve) {
              setTimeout(function () {
                resolve(_this.build());
              }, 300);
            }));

          case 4:
            this._building = true;
            // Wait for Nuxt.js to be ready
            _context.next = 7;
            return this.ready();

          case 7:
            // Check if pages dir exists and warn if not
            this._nuxtPages = typeof this.createRoutes !== 'function';
            if (this._nuxtPages) {
              if (!__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(this.srcDir, 'pages'))) {
                if (__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(this.srcDir, '..', 'pages'))) {
                  console.error('> No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?'); // eslint-disable-line no-console
                } else {
                  console.error('> Couldn\'t find a `pages` directory. Please create one under the project root'); // eslint-disable-line no-console
                }
                process.exit(1);
              }
            }
            debug('App root: ' + this.srcDir);
            debug('Generating ' + this.buildDir + ' files...');
            // Create .nuxt/, .nuxt/components and .nuxt/dist folders
            _context.next = 13;
            return remove(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.buildDir));

          case 13:
            _context.next = 15;
            return mkdirp(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.buildDir, 'components'));

          case 15:
            if (this.dev) {
              _context.next = 18;
              break;
            }

            _context.next = 18;
            return mkdirp(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.buildDir, 'dist'));

          case 18:
            _context.next = 20;
            return generateRoutesAndFiles.call(this);

          case 20:
            _context.next = 22;
            return buildFiles.call(this);

          case 22:
            // Flag to set that building is done
            this._buildDone = true;
            return _context.abrupt('return', this);

          case 24:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function build() {
    return _ref.apply(this, arguments);
  };
}();

function addAppTemplate() {
  var templatePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["resolve"])(this.buildDir, 'dist', 'index.html');
  if (__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.existsSync(templatePath)) {
    this.appTemplate = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.template(__WEBPACK_IMPORTED_MODULE_6_fs_extra___default.a.readFileSync(templatePath, 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    });
  }
}

function createRoutes(files, srcDir) {
  var routes = [];
  files.forEach(function (file) {
    var keys = file.replace(/^pages/, '').replace(/\.vue$/, '').replace(/\/{2,}/g, '/').split('/').slice(1);
    var route = { name: '', path: '', component: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(srcDir, file) };
    var parent = routes;
    keys.forEach(function (key, i) {
      route.name = route.name ? route.name + '-' + key.replace('_', '') : key.replace('_', '');
      route.name += key === '_' ? 'all' : '';
      var child = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.find(parent, { name: route.name });
      if (child) {
        if (!child.children) {
          child.children = [];
        }
        parent = child.children;
        route.path = '';
      } else {
        if (key === 'index' && i + 1 === keys.length) {
          route.path += i > 0 ? '' : '/';
        } else {
          route.path += '/' + (key === '_' ? '*' : key.replace('_', ':'));
          if (key !== '_' && key.indexOf('_') !== -1) {
            route.path += '?';
          }
        }
      }
    });
    // Order Routes path
    parent.push(route);
    parent.sort(function (a, b) {
      if (!a.path.length || a.path === '/') {
        return -1;
      }
      if (!b.path.length || b.path === '/') {
        return 1;
      }
      var res = 0;
      var _a = a.path.split('/');
      var _b = b.path.split('/');
      for (var i = 0; i < _a.length; i++) {
        if (res !== 0) {
          break;
        }
        var y = _a[i].indexOf('*') > -1 ? 2 : _a[i].indexOf(':') > -1 ? 1 : 0;
        var z = _b[i].indexOf('*') > -1 ? 2 : _b[i].indexOf(':') > -1 ? 1 : 0;
        res = y - z;
        if (i === _b.length - 1 && res === 0) {
          res = 1;
        }
      }
      return res === 0 ? -1 : res;
    });
  });
  return cleanChildrenRoutes(routes);
}

function cleanChildrenRoutes(routes) {
  var isChild = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  var start = -1;
  var routesIndex = [];
  routes.forEach(function (route) {
    if (/-index$/.test(route.name) || route.name === 'index') {
      // Save indexOf 'index' key in name
      var res = route.name.split('-');
      var s = res.indexOf('index');
      start = start === -1 || s < start ? s : start;
      routesIndex.push(res);
    }
  });
  routes.forEach(function (route) {
    route.path = isChild ? route.path.replace('/', '') : route.path;
    if (route.path.indexOf('?') > -1) {
      var names = route.name.split('-');
      var paths = route.path.split('/');
      if (!isChild) {
        paths.shift();
      } // clean first / for parents
      routesIndex.forEach(function (r) {
        var i = r.indexOf('index') - start; //  children names
        if (i < paths.length) {
          for (var a = 0; a <= i; a++) {
            if (a === i) {
              paths[a] = paths[a].replace('?', '');
            }
            if (a < i && names[a] !== r[a]) {
              break;
            }
          }
        }
      });
      route.path = (isChild ? '' : '/') + paths.join('/');
    }
    route.name = route.name.replace(/-index$/, '');
    if (route.children) {
      if (route.children.find(function (child) {
        return child.path === '';
      })) {
        delete route.name;
      }
      route.children = cleanChildrenRoutes(route.children, true);
    }
  });
  return routes;
}

function flatRoutes(router) {
  var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var routes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  router.forEach(function (r) {
    if (!(r.path.indexOf(':') !== -1) && !(r.path.indexOf('*') !== -1)) {
      if (r.children) {
        flatRoutes(r.children, path + r.path + '/', routes);
      } else {
        routes.push((r.path === '' && path[path.length - 1] === '/' ? path.slice(0, -1) : path) + r.path);
      }
    }
  });
  return routes;
}

function getWebpackClientConfig() {
  return __WEBPACK_IMPORTED_MODULE_15__webpack_client_config_js__["a" /* default */].call(this);
}

function getWebpackServerConfig() {
  return __WEBPACK_IMPORTED_MODULE_16__webpack_server_config_js__["a" /* default */].call(this);
}

function createWebpackMiddleware() {
  var _this3 = this;

  var clientConfig = getWebpackClientConfig.call(this);
  var host = process.env.HOST || process.env.npm_package_config_nuxt_host || '127.0.0.1';
  var port = process.env.PORT || process.env.npm_package_config_nuxt_port || '3000';
  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.flatten(['webpack-hot-middleware/client?reload=true', clientConfig.entry.app]);
  clientConfig.plugins.push(new __WEBPACK_IMPORTED_MODULE_9_webpack___default.a.HotModuleReplacementPlugin(), new __WEBPACK_IMPORTED_MODULE_9_webpack___default.a.NoEmitOnErrorsPlugin(), new __WEBPACK_IMPORTED_MODULE_10_post_compile_webpack_plugin___default.a(function (stats) {
    if (!stats.hasErrors() && !stats.hasWarnings()) {
      console.log('> Open http://' + host + ':' + port + '\n'); // eslint-disable-line no-console
    }
  }));
  var clientCompiler = __WEBPACK_IMPORTED_MODULE_9_webpack___default()(clientConfig);
  this.clientCompiler = clientCompiler;
  // Add the middleware to the instance context
  this.webpackDevMiddleware = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__webpack_require__(54)(clientCompiler, __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()(clientConfig.devServer || {}, {
    publicPath: clientConfig.output.publicPath,
    stats: webpackStats,
    quiet: true,
    noInfo: true,
    watchOptions: this.options.watchers.webpack
  })));

  this.webpackHotMiddleware = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__webpack_require__(55)(clientCompiler, {
    log: function log() {}
  }));
  clientCompiler.plugin('done', function () {
    var fs = _this3.webpackDevMiddleware.fileSystem;
    var filePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(clientConfig.output.path, 'index.html');
    if (fs.existsSync(filePath)) {
      var template = fs.readFileSync(filePath, 'utf-8');
      _this3.appTemplate = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.template(template, {
        interpolate: /{{([\s\S]+?)}}/g
      });
    }
    _this3.watchHandler();
  });
}

function webpackWatchAndUpdate() {
  var _this4 = this;

  var MFS = __webpack_require__(46); // <- dependencies of webpack
  var serverFS = new MFS();
  var clientFS = this.clientCompiler.outputFileSystem;
  var serverConfig = getWebpackServerConfig.call(this);
  var serverCompiler = __WEBPACK_IMPORTED_MODULE_9_webpack___default()(serverConfig);
  var bundlePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'server-bundle.json');
  var manifestPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'client-manifest.json');
  serverCompiler.outputFileSystem = serverFS;
  var watchHandler = function watchHandler(err) {
    if (err) throw err;
    var bundleExists = serverFS.existsSync(bundlePath);
    var manifestExists = clientFS.existsSync(manifestPath);
    if (bundleExists && manifestExists) {
      var bundle = serverFS.readFileSync(bundlePath, 'utf8');
      var manifest = clientFS.readFileSync(manifestPath, 'utf8');
      createRenderer.call(_this4, JSON.parse(bundle), JSON.parse(manifest));
    }
  };
  this.watchHandler = watchHandler;
  this.webpackServerWatcher = serverCompiler.watch(this.options.watchers.webpack, watchHandler);
}

function webpackRunClient() {
  var _this5 = this;

  return new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
    var clientConfig = getWebpackClientConfig.call(_this5);
    var clientCompiler = __WEBPACK_IMPORTED_MODULE_9_webpack___default()(clientConfig);
    clientCompiler.run(function (err, stats) {
      if (err) return reject(err);
      console.log('[nuxt:build:client]\n', stats.toString(webpackStats)); // eslint-disable-line no-console
      if (stats.hasErrors()) return reject(new Error('Webpack build exited with errors'));
      resolve();
    });
  });
}

function webpackRunServer() {
  var _this6 = this;

  return new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
    var serverConfig = getWebpackServerConfig.call(_this6);
    var serverCompiler = __WEBPACK_IMPORTED_MODULE_9_webpack___default()(serverConfig);
    serverCompiler.run(function (err, stats) {
      if (err) return reject(err);
      console.log('[nuxt:build:server]\n', stats.toString(webpackStats)); // eslint-disable-line no-console
      if (stats.hasErrors()) return reject(new Error('Webpack build exited with errors'));
      var bundlePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'server-bundle.json');
      var manifestPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_13_path__["join"])(serverConfig.output.path, 'client-manifest.json');
      readFile(bundlePath, 'utf8').then(function (bundle) {
        readFile(manifestPath, 'utf8').then(function (manifest) {
          createRenderer.call(_this6, JSON.parse(bundle), JSON.parse(manifest));
          resolve();
        });
      });
    });
  });
}

function createRenderer(bundle, manifest) {
  // Create bundle renderer to give a fresh context for every request
  this.renderer = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_12_vue_server_renderer__["createBundleRenderer"])(bundle, __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({
    clientManifest: manifest,
    runInNewContext: false,
    basedir: this.dir
  }, this.options.build.ssr));
  this.renderToString = __WEBPACK_IMPORTED_MODULE_8_pify___default()(this.renderer.renderToString);
  this.renderToStream = this.renderer.renderToStream;
}

function watchFiles() {
  var _this7 = this;

  var patterns = [__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'layouts'), __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'store'), __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'middleware'), __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'layouts/*.vue'), __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'layouts/**/*.vue')];
  if (this._nuxtPages) {
    patterns.push(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'pages'));
    patterns.push(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'pages/*.vue'));
    patterns.push(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_14__utils__["r"])(this.srcDir, 'pages/**/*.vue'));
  }
  var options = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({}, this.options.watchers.chokidar, {
    ignoreInitial: true
  });
  /* istanbul ignore next */
  var refreshFiles = __WEBPACK_IMPORTED_MODULE_4_lodash___default.a.debounce(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee5() {
    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return generateRoutesAndFiles.call(_this7);

          case 2:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, _this7);
  })), 200);
  // Watch for internals
  this.filesWatcher = __WEBPACK_IMPORTED_MODULE_5_chokidar___default.a.watch(patterns, options).on('add', refreshFiles).on('unlink', refreshFiles);
  // Watch for custom provided files
  this.customFilesWatcher = __WEBPACK_IMPORTED_MODULE_5_chokidar___default.a.watch(__WEBPACK_IMPORTED_MODULE_4_lodash___default.a.uniq(this.options.build.watch), options).on('change', refreshFiles);
}

/***/ }),
/* 21 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_fs_extra__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_fs_extra___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_fs_extra__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_pify__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_pify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_pify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__utils__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_html_minifier__ = __webpack_require__(42);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_html_minifier___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_9_html_minifier__);












var debug = __webpack_require__(7)('nuxt:generate');
var copy = __WEBPACK_IMPORTED_MODULE_5_pify___default()(__WEBPACK_IMPORTED_MODULE_4_fs_extra___default.a.copy);
var remove = __WEBPACK_IMPORTED_MODULE_5_pify___default()(__WEBPACK_IMPORTED_MODULE_4_fs_extra___default.a.remove);
var writeFile = __WEBPACK_IMPORTED_MODULE_5_pify___default()(__WEBPACK_IMPORTED_MODULE_4_fs_extra___default.a.writeFile);
var mkdirp = __WEBPACK_IMPORTED_MODULE_5_pify___default()(__WEBPACK_IMPORTED_MODULE_4_fs_extra___default.a.mkdirp);

var defaults = {
  dir: 'dist',
  routes: [],
  interval: 0,
  minify: {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    removeAttributeQuotes: false,
    removeComments: false,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: false,
    removeStyleLinkTypeAttributes: false,
    removeTagWhitespace: false,
    sortAttributes: true,
    sortClassName: true,
    trimCustomFragments: true,
    useShortDoctype: true
  }
};

/* harmony default export */ __webpack_exports__["a"] = (__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _callee2() {
  var _this = this;

  var s, errors, srcStaticPath, srcBuiltPath, distPath, distNuxtPath, generateRoutes, decorateWithPayloads, routes, _loop, nojekyllPath, duration, report;

  return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _callee2$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          decorateWithPayloads = function decorateWithPayloads(routes) {
            var routeMap = {};
            // Fill routeMap for known routes
            routes.forEach(function (route) {
              routeMap[route] = {
                route: route,
                payload: null
              };
            });
            // Fill routeMap with given generate.routes
            generateRoutes.forEach(function (route) {
              // route is either a string or like {route : "/my_route/1"}
              var path = __WEBPACK_IMPORTED_MODULE_6_lodash___default.a.isString(route) ? route : route.route;
              routeMap[path] = {
                route: path,
                payload: route.payload || null
              };
            });
            return __WEBPACK_IMPORTED_MODULE_6_lodash___default.a.values(routeMap);
          };

          s = Date.now();
          errors = [];
          /*
          ** Wait for modules to be initialized
          */

          _context3.next = 5;
          return this.ready();

        case 5:
          /*
          ** Set variables
          */
          this.options.generate = __WEBPACK_IMPORTED_MODULE_6_lodash___default.a.defaultsDeep(this.options.generate, defaults);
          srcStaticPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(this.srcDir, 'static');
          srcBuiltPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(this.buildDir, 'dist');
          distPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(this.dir, this.options.generate.dir);
          distNuxtPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["join"])(distPath, __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["isUrl"])(this.options.build.publicPath) ? '' : this.options.build.publicPath);
          /*
          ** Launch build process
          */

          _context3.next = 12;
          return this.build();

        case 12:
          _context3.prev = 12;
          _context3.next = 15;
          return remove(distPath);

        case 15:
          debug('Destination folder cleaned');
          _context3.next = 20;
          break;

        case 18:
          _context3.prev = 18;
          _context3.t0 = _context3['catch'](12);

        case 20:
          if (!__WEBPACK_IMPORTED_MODULE_4_fs_extra___default.a.existsSync(srcStaticPath)) {
            _context3.next = 23;
            break;
          }

          _context3.next = 23;
          return copy(srcStaticPath, distPath);

        case 23:
          _context3.next = 25;
          return copy(srcBuiltPath, distNuxtPath);

        case 25:
          debug('Static & build files copied');

          if (!(this.options.router.mode !== 'hash')) {
            _context3.next = 39;
            break;
          }

          _context3.prev = 27;
          _context3.next = 30;
          return __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["promisifyRoute"])(this.options.generate.routes || []);

        case 30:
          generateRoutes = _context3.sent;
          _context3.next = 39;
          break;

        case 33:
          _context3.prev = 33;
          _context3.t1 = _context3['catch'](27);

          console.error('Could not resolve routes'); // eslint-disable-line no-console
          console.error(_context3.t1); // eslint-disable-line no-console
          process.exit(1);
          throw _context3.t1;

        case 39:
          /*
          ** Generate only index.html for router.mode = 'hash'
          */
          routes = this.options.router.mode === 'hash' ? ['/'] : this.routes;

          routes = decorateWithPayloads(routes);

          _loop = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _loop() {
            var n;
            return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _loop$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    n = 0;
                    _context2.next = 3;
                    return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_promise___default.a.all(routes.splice(0, 500).map(function () {
                      var _ref3 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _callee(_ref4) {
                        var route = _ref4.route,
                            payload = _ref4.payload;
                        var html, res, minifyErr, path;
                        return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
                          while (1) {
                            switch (_context.prev = _context.next) {
                              case 0:
                                _context.next = 2;
                                return __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["waitFor"])(n++ * _this.options.generate.interval);

                              case 2:
                                html = void 0;
                                _context.prev = 3;
                                _context.next = 6;
                                return _this.renderRoute(route, { _generate: true, payload: payload });

                              case 6:
                                res = _context.sent;

                                html = res.html;
                                if (res.error) {
                                  errors.push({ type: 'handled', route: route, error: res.error });
                                }
                                _context.next = 14;
                                break;

                              case 11:
                                _context.prev = 11;
                                _context.t0 = _context['catch'](3);
                                return _context.abrupt('return', errors.push({ type: 'unhandled', route: route, error: _context.t0 }));

                              case 14:
                                if (_this.options.generate.minify) {
                                  try {
                                    html = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_9_html_minifier__["minify"])(html, _this.options.generate.minify);
                                  } catch (err) /* istanbul ignore next */{
                                    minifyErr = new Error('HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n ' + html);

                                    errors.push({ type: 'unhandled', route: route, error: minifyErr });
                                  }
                                }
                                path = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["join"])(route, __WEBPACK_IMPORTED_MODULE_7_path__["sep"], 'index.html'); // /about -> /about/index.html

                                debug('Generate file: ' + path);
                                path = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["join"])(distPath, path);
                                // Make sure the sub folders are created
                                _context.next = 20;
                                return mkdirp(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["dirname"])(path));

                              case 20:
                                _context.next = 22;
                                return writeFile(path, html, 'utf8');

                              case 22:
                              case 'end':
                                return _context.stop();
                            }
                          }
                        }, _callee, _this, [[3, 11]]);
                      }));

                      return function (_x) {
                        return _ref3.apply(this, arguments);
                      };
                    }()));

                  case 3:
                  case 'end':
                    return _context2.stop();
                }
              }
            }, _loop, _this);
          });

        case 42:
          if (!routes.length) {
            _context3.next = 46;
            break;
          }

          return _context3.delegateYield(_loop(), 't2', 44);

        case 44:
          _context3.next = 42;
          break;

        case 46:
          // Add .nojekyll file to let Github Pages add the _nuxt/ folder
          // https://help.github.com/articles/files-that-start-with-an-underscore-are-missing/
          nojekyllPath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(distPath, '.nojekyll');

          writeFile(nojekyllPath, '');
          duration = Math.round((Date.now() - s) / 100) / 10;

          debug('HTML Files generated in ' + duration + 's');

          if (errors.length) {
            report = errors.map(function (_ref2) {
              var type = _ref2.type,
                  route = _ref2.route,
                  error = _ref2.error;

              /* istanbul ignore if */
              if (type === 'unhandled') {
                return 'Route: \'' + route + '\'\n' + error.stack;
              } else {
                return 'Route: \'' + route + '\' thrown an error: \n' + __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify___default()(error);
              }
            });

            console.error('==== Error report ==== \n' + report.join('\n\n')); // eslint-disable-line no-console
          }

        case 51:
        case 'end':
          return _context3.stop();
      }
    }
  }, _callee2, this, [[12, 18], [27, 33]]);
})));

/***/ }),
/* 22 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_typeof__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_typeof___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_typeof__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_classCallCheck__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_classCallCheck___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_classCallCheck__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_babel_runtime_helpers_createClass__ = __webpack_require__(9);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_babel_runtime_helpers_createClass___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_babel_runtime_helpers_createClass__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fs__ = __webpack_require__(40);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fs___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_fs__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_hash_sum__ = __webpack_require__(18);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_hash_sum___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_9_hash_sum__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__utils__ = __webpack_require__(2);














var debug = __webpack_require__(7)('nuxt:module');

var Module = function () {
  function Module(nuxt) {
    __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_classCallCheck___default()(this, Module);

    this.nuxt = nuxt;
    this.options = nuxt.options;
    this.requiredModules = [];
    this.initing = this.ready();
  }

  __WEBPACK_IMPORTED_MODULE_5_babel_runtime_helpers_createClass___default()(Module, [{
    key: 'ready',
    value: function () {
      var _ref = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_regenerator___default.a.mark(function _callee() {
        return __WEBPACK_IMPORTED_MODULE_2_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this.initing) {
                  _context.next = 4;
                  break;
                }

                _context.next = 3;
                return this.initing;

              case 3:
                return _context.abrupt('return', this);

              case 4:
                _context.next = 6;
                return __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_10__utils__["sequence"])(this.options.modules, this.addModule.bind(this));

              case 6:
                return _context.abrupt('return', this);

              case 7:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ready() {
        return _ref.apply(this, arguments);
      }

      return ready;
    }()
  }, {
    key: 'addVendor',
    value: function addVendor(vendor) {
      /* istanbul ignore if */
      if (!vendor) {
        return;
      }
      this.options.build.vendor = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8_lodash__["uniq"])(this.options.build.vendor.concat(vendor));
    }
  }, {
    key: 'addTemplate',
    value: function addTemplate(template) {
      /* istanbul ignore if */
      if (!template) {
        return;
      }
      // Validate & parse source
      var src = template.src || template;
      var srcPath = __WEBPACK_IMPORTED_MODULE_6_path___default.a.parse(src);
      /* istanbul ignore if */
      if (!src || typeof src !== 'string' || !__WEBPACK_IMPORTED_MODULE_7_fs___default.a.existsSync(src)) {
        debug('[nuxt] invalid template', template);
        return;
      }
      // Generate unique and human readable dst filename
      var dst = template.fileName || __WEBPACK_IMPORTED_MODULE_6_path___default.a.basename(srcPath.dir) + '.' + srcPath.name + '.' + __WEBPACK_IMPORTED_MODULE_9_hash_sum___default()(src) + srcPath.ext;
      // Add to templates list
      var templateObj = {
        src: src,
        dst: dst,
        options: template.options
      };
      this.options.build.templates.push(templateObj);
      return templateObj;
    }
  }, {
    key: 'addPlugin',
    value: function addPlugin(template) {
      var _addTemplate = this.addTemplate(template),
          dst = _addTemplate.dst;
      // Add to nuxt plugins


      this.options.plugins.unshift({
        src: __WEBPACK_IMPORTED_MODULE_6_path___default.a.join(this.nuxt.buildDir, dst),
        ssr: template.ssr
      });
    }
  }, {
    key: 'addServerMiddleware',
    value: function addServerMiddleware(middleware) {
      this.options.serverMiddleware.push(middleware);
    }
  }, {
    key: 'extendBuild',
    value: function extendBuild(fn) {
      this.options.build.extend = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_10__utils__["chainFn"])(this.options.build.extend, fn);
    }
  }, {
    key: 'extendRoutes',
    value: function extendRoutes(fn) {
      this.options.router.extendRoutes = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_10__utils__["chainFn"])(this.options.router.extendRoutes, fn);
    }
  }, {
    key: 'requireModule',
    value: function requireModule(moduleOpts) {
      // Require once
      return this.addModule(moduleOpts, true);
    }
  }, {
    key: 'addModule',
    value: function addModule(moduleOpts, requireOnce) {
      var _this = this;

      /* istanbul ignore if */
      if (!moduleOpts) {
        return;
      }
      // Allow using babel style array options
      if (Array.isArray(moduleOpts)) {
        moduleOpts = {
          src: moduleOpts[0],
          options: moduleOpts[1]
        };
      }
      // Allows passing runtime options to each module
      var options = moduleOpts.options || ((typeof moduleOpts === 'undefined' ? 'undefined' : __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_typeof___default()(moduleOpts)) === 'object' ? moduleOpts : {});
      var originalSrc = moduleOpts.src || moduleOpts;
      // Resolve module
      var module = originalSrc;
      try {
        if (typeof module === 'string') {
          // Using ~ or ./ shorthand modules are resolved from project srcDir
          if (module.indexOf('~') === 0 || module.indexOf('./') === 0) {
            module = __WEBPACK_IMPORTED_MODULE_6_path___default.a.join(this.options.srcDir, module.substr(1));
          }
          // eslint-disable-next-line no-eval
          module = eval('require')(module);
        }
      } catch (e) /* istanbul ignore next */{
        // eslint-disable-next-line no-console
        console.error('[nuxt] Unable to resolve module', module);
        // eslint-disable-next-line no-console
        console.error(e);
        process.exit(0);
      }
      // Validate module
      /* istanbul ignore if */
      if (typeof module !== 'function') {
        // eslint-disable-next-line no-console
        console.error('[nuxt] Module [' + originalSrc + '] should export a function');
        process.exit(1);
      }
      // Module meta
      if (!module.meta) {
        module.meta = {};
      }
      if (module.meta.name) {
        var alreadyRequired = this.requiredModules.indexOf(module.meta.name) !== -1;
        if (requireOnce && alreadyRequired) {
          return;
        }
        if (!alreadyRequired) {
          this.requiredModules.push(module.meta.name);
        }
      }
      // Call module with `this` context and pass options
      return new __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
        var result = module.call(_this, options, function (err) {
          /* istanbul ignore if */
          if (err) {
            return reject(err);
          }
          resolve(module);
        });
        // If module send back a promise
        if (result && result.then instanceof Function) {
          return result.then(resolve);
        }
        // If not expecting a callback but returns no promise (=synchronous)
        if (module.length < 2) {
          return resolve(module);
        }
      });
    }
  }]);

  return Module;
}();

/* harmony default export */ __webpack_exports__["a"] = (Module);

/***/ }),
/* 23 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return render; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return renderRoute; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return renderAndGetWindow; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_slicedToArray__ = __webpack_require__(34);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_slicedToArray___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_slicedToArray__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_ansi_html__ = __webpack_require__(31);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_ansi_html___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_ansi_html__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_serialize_javascript__ = __webpack_require__(19);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_serialize_javascript___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_serialize_javascript__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_etag__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_etag___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_etag__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fresh__ = __webpack_require__(38);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fresh___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_fresh__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__utils__ = __webpack_require__(2);












var debug = __webpack_require__(7)('nuxt:render');
// force blue color
debug.color = 4;
__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["setAnsiColors"])(__WEBPACK_IMPORTED_MODULE_4_ansi_html___default.a);

var render = function () {
  var _ref = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _callee(req, res) {
    var _this = this;

    var context, url, _ref2, html, error, redirected, resourceHints, etag, regex, pushAssets, m, _m, _m2, _, rel, href, as, _html;

    return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.ready();

          case 2:
            // Check if project is built for production
            if (!this.renderer && !this.dev) {
              console.error('> No build files found, please run `nuxt build` before launching `nuxt start`'); // eslint-disable-line no-console
              process.exit(1);
            }
            /* istanbul ignore if */

            if (!(!this.renderer || !this.appTemplate)) {
              _context.next = 5;
              break;
            }

            return _context.abrupt('return', new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve) {
              setTimeout(function () {
                resolve(_this.render(req, res));
              }, 1000);
            }));

          case 5:
            // Get context
            context = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["getContext"])(req, res);

            res.statusCode = 200;
            _context.prev = 7;

            if (!this.dev) {
              _context.next = 13;
              break;
            }

            _context.next = 11;
            return this.webpackDevMiddleware(req, res);

          case 11:
            _context.next = 13;
            return this.webpackHotMiddleware(req, res);

          case 13:
            if (!(!this.dev && this.options.render.gzip)) {
              _context.next = 16;
              break;
            }

            _context.next = 16;
            return this.gzipMiddleware(req, res);

          case 16:
            // If base in req.url, remove it for the middleware and vue-router
            if (this.options.router.base !== '/' && req.url.indexOf(this.options.router.base) === 0) {
              // Compatibility with base url for dev server
              req.url = req.url.replace(this.options.router.base, '/');
            }
            // Serve static/ files
            _context.next = 19;
            return this.serveStatic(req, res);

          case 19:
            if (!(!this.dev && req.url.indexOf(this.options.build.publicPath) === 0)) {
              _context.next = 25;
              break;
            }

            url = req.url;

            req.url = req.url.replace(this.options.build.publicPath, '/');
            _context.next = 24;
            return this.serveStaticNuxt(req, res);

          case 24:
            /* istanbul ignore next */
            req.url = url;

          case 25:
            if (!(this.dev && req.url.indexOf(this.options.build.publicPath) === 0 && req.url.indexOf('.hot-update.json') !== -1)) {
              _context.next = 28;
              break;
            }

            res.statusCode = 404;
            return _context.abrupt('return', res.end());

          case 28:
            _context.next = 30;
            return this.renderRoute(req.url, context);

          case 30:
            _ref2 = _context.sent;
            html = _ref2.html;
            error = _ref2.error;
            redirected = _ref2.redirected;
            resourceHints = _ref2.resourceHints;

            if (!redirected) {
              _context.next = 37;
              break;
            }

            return _context.abrupt('return', html);

          case 37:
            if (error) {
              res.statusCode = context.nuxt.error.statusCode || 500;
            }
            // ETag header

            if (!(!error && this.options.render.etag)) {
              _context.next = 45;
              break;
            }

            etag = __WEBPACK_IMPORTED_MODULE_6_etag___default()(html, this.options.render.etag);

            if (!__WEBPACK_IMPORTED_MODULE_7_fresh___default()(req.headers, { etag: etag })) {
              _context.next = 44;
              break;
            }

            res.statusCode = 304;
            res.end();
            return _context.abrupt('return');

          case 44:
            res.setHeader('ETag', etag);

          case 45:
            // HTTP2 push headers
            if (!error && this.options.render.http2.push) {
              // Parse resourceHints to extract HTTP.2 prefetch/push headers
              // https://w3c.github.io/preload/#server-push-http-2
              regex = /link rel="([^"]*)" href="([^"]*)" as="([^"]*)"/g;
              pushAssets = [];
              m = void 0;

              while (m = regex.exec(resourceHints)) {
                // eslint-disable-line no-cond-assign
                _m = m, _m2 = __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_slicedToArray___default()(_m, 4), _ = _m2[0], rel = _m2[1], href = _m2[2], as = _m2[3]; // eslint-disable-line no-unused-vars

                if (rel === 'preload') {
                  pushAssets.push('<' + href + '>; rel=' + rel + '; as=' + as);
                }
              }
              // Pass with single Link header
              // https://blog.cloudflare.com/http-2-server-push-with-multiple-assets-per-link-header
              res.setHeader('Link', pushAssets.join(','));
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(html));
            res.end(html, 'utf8');
            return _context.abrupt('return', html);

          case 52:
            _context.prev = 52;
            _context.t0 = _context['catch'](7);

            if (!context.redirected) {
              _context.next = 57;
              break;
            }

            console.error(_context.t0); // eslint-disable-line no-console
            return _context.abrupt('return', _context.t0);

          case 57:
            _html = this.errorTemplate({
              /* istanbul ignore if */
              error: _context.t0,
              stack: __WEBPACK_IMPORTED_MODULE_4_ansi_html___default()(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_8__utils__["encodeHtml"])(_context.t0.stack))
            });

            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(_html));
            res.end(_html, 'utf8');
            return _context.abrupt('return', _context.t0);

          case 63:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[7, 52]]);
  }));

  return function render(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

var renderRoute = function () {
  var _ref3 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _callee2(url) {
    var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var APP, m, HEAD, resourceHints, html;
    return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.ready();

          case 2:
            // Log rendered url
            debug('Rendering url ' + url);
            // Add url and isSever to the context
            context.url = url;
            context.isServer = true;
            // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
            _context2.next = 7;
            return this.renderToString(context);

          case 7:
            APP = _context2.sent;

            if (!context.nuxt.serverRendered) {
              APP = '<div id="__nuxt"></div>';
            }
            m = context.meta.inject();
            HEAD = m.meta.text() + m.title.text() + m.link.text() + m.style.text() + m.script.text() + m.noscript.text();

            if (this._routerBaseSpecified) {
              HEAD += '<base href="' + this.options.router.base + '">';
            }
            resourceHints = context.renderResourceHints();

            HEAD += resourceHints + context.renderStyles();
            APP += '<script type="text/javascript">window.__NUXT__=' + __WEBPACK_IMPORTED_MODULE_5_serialize_javascript___default()(context.nuxt, { isJSON: true }) + '</script>';
            APP += context.renderScripts();
            html = this.appTemplate({
              HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
              BODY_ATTRS: m.bodyAttrs.text(),
              HEAD: HEAD,
              APP: APP
            });
            return _context2.abrupt('return', {
              html: html,
              resourceHints: resourceHints,
              error: context.nuxt.error,
              redirected: context.redirected
            });

          case 18:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function renderRoute(_x3) {
    return _ref3.apply(this, arguments);
  };
}();

// Function used to do dom checking via jsdom
var jsdom = null;
var renderAndGetWindow = function () {
  var _ref4 = __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.mark(function _callee3(url) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var options, _ref5, window, nuxtExists, error;

    return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_regenerator___default.a.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            /* istanbul ignore if */
            if (!jsdom) {
              try {
                jsdom = __webpack_require__(45);
              } catch (e) {
                console.error('Fail when calling nuxt.renderAndGetWindow(url)'); // eslint-disable-line no-console
                console.error('jsdom module is not installed'); // eslint-disable-line no-console
                console.error('Please install jsdom with: npm install --save-dev jsdom'); // eslint-disable-line no-console
                process.exit(1);
              }
            }
            options = {
              resources: 'usable', // load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
              runScripts: 'dangerously',
              beforeParse: function beforeParse(window) {
                // Mock window.scrollTo
                window.scrollTo = function () {};
              }
            };

            if (opts.virtualConsole !== false) {
              options.virtualConsole = new jsdom.VirtualConsole().sendTo(console);
            }
            url = url || 'http://localhost:3000';
            _context3.next = 6;
            return jsdom.JSDOM.fromURL(url, options);

          case 6:
            _ref5 = _context3.sent;
            window = _ref5.window;

            // If Nuxt could not be loaded (error from the server-side)
            nuxtExists = window.document.body.innerHTML.indexOf('window.__NUXT__') !== -1;

            if (nuxtExists) {
              _context3.next = 13;
              break;
            }

            /* istanbul ignore next */
            error = new Error('Could not load the nuxt app');
            /* istanbul ignore next */

            error.body = window.document.body.innerHTML;
            throw error;

          case 13:
            _context3.next = 15;
            return new __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_promise___default.a(function (resolve) {
              window._onNuxtLoaded = function () {
                return resolve(window);
              };
            });

          case 15:
            return _context3.abrupt('return', window);

          case 16:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  return function renderAndGetWindow(_x5) {
    return _ref4.apply(this, arguments);
  };
}();

/***/ }),
/* 24 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_classCallCheck__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_classCallCheck___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_classCallCheck__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_createClass__ = __webpack_require__(9);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_createClass___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_createClass__);




var http = __webpack_require__(44);
var connect = __webpack_require__(36);
var path = __webpack_require__(1);

var Server = function () {
  function Server(nuxt) {
    var _this = this;

    __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_classCallCheck___default()(this, Server);

    this.nuxt = nuxt;
    // Initialize
    this.app = connect();
    this.server = http.createServer(this.app);
    this.nuxt.ready().then(function () {
      // Add Middleware
      _this.nuxt.options.serverMiddleware.forEach(function (m) {
        _this.useMiddleware(m);
      });
      // Add default render middleware
      _this.useMiddleware(_this.render.bind(_this));
    });
    return this;
  }

  __WEBPACK_IMPORTED_MODULE_1_babel_runtime_helpers_createClass___default()(Server, [{
    key: 'useMiddleware',
    value: function useMiddleware(m) {
      // Require if needed
      if (typeof m === 'string') {
        var src = m;
        // Using ~ or ./ shorthand to resolve from project srcDir
        if (src.indexOf('~') === 0 || src.indexOf('./') === 0) {
          src = path.join(this.nuxt.options.srcDir, src.substr(1));
        }
        // eslint-disable-next-line no-eval
        m = eval('require')(src);
      }
      if (m instanceof Function) {
        this.app.use(m);
      } else if (m && m.path && m.handler) {
        this.app.use(m.path, m.handler);
      }
    }
  }, {
    key: 'render',
    value: function render(req, res, next) {
      this.nuxt.render(req, res);
      return this;
    }
  }, {
    key: 'listen',
    value: function listen(port, host) {
      var _this2 = this;

      host = host || '127.0.0.1';
      port = port || 3000;
      this.nuxt.ready().then(function () {
        _this2.server.listen(port, host, function () {
          console.log('Ready on http://%s:%s', host, port); // eslint-disable-line no-console
        });
      });
      return this;
    }
  }, {
    key: 'close',
    value: function close(cb) {
      return this.server.close(cb);
    }
  }]);

  return Server;
}();

/* harmony default export */ __webpack_exports__["a"] = (Server);

/***/ }),
/* 25 */
/***/ (function(module, exports) {

module.exports = require("compression");

/***/ }),
/* 26 */
/***/ (function(module, exports) {

module.exports = require("serve-static");

/***/ }),
/* 27 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_helpers_asyncToGenerator__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_helpers_asyncToGenerator___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_helpers_asyncToGenerator__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_classCallCheck__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_classCallCheck___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_classCallCheck__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_createClass__ = __webpack_require__(9);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_createClass___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_createClass__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_compression__ = __webpack_require__(25);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_compression___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_compression__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fs_extra__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_fs_extra___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_fs_extra__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_pify__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_pify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_pify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__server__ = __webpack_require__(24);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__module__ = __webpack_require__(22);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11__build__ = __webpack_require__(20);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12__render__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13__generate__ = __webpack_require__(21);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14_serve_static__ = __webpack_require__(26);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14_serve_static___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_14_serve_static__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_15_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_15_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_15_path__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_16__utils__ = __webpack_require__(2);




















var Nuxt = function () {
  function Nuxt() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    __WEBPACK_IMPORTED_MODULE_3_babel_runtime_helpers_classCallCheck___default()(this, Nuxt);

    var defaults = {
      dev: process.env.NODE_ENV !== 'production',
      buildDir: '.nuxt',
      env: {},
      head: {
        meta: [],
        link: [],
        style: [],
        script: []
      },
      plugins: [],
      css: [],
      modules: [],
      layouts: {},
      serverMiddleware: [],
      ErrorPage: null,
      loading: {
        color: 'black',
        failedColor: 'red',
        height: '2px',
        duration: 5000
      },
      transition: {
        name: 'page',
        mode: 'out-in'
      },
      router: {
        mode: 'history',
        base: '/',
        middleware: [],
        linkActiveClass: 'nuxt-link-active',
        linkExactActiveClass: 'nuxt-link-exact-active',
        extendRoutes: null,
        scrollBehavior: null
      },
      render: {
        http2: {
          push: false
        },
        static: {},
        gzip: {
          threshold: 0
        },
        etag: {
          weak: true // Faster for responses > 5KB
        }
      },
      watchers: {
        webpack: {},
        chokidar: {}
      }
      // Sanitization
    };if (options.loading === true) delete options.loading;
    if (options.router && typeof options.router.middleware === 'string') options.router.middleware = [options.router.middleware];
    if (options.router && typeof options.router.base === 'string') {
      this._routerBaseSpecified = true;
    }
    if (typeof options.transition === 'string') options.transition = { name: options.transition };
    this.options = __WEBPACK_IMPORTED_MODULE_5_lodash___default.a.defaultsDeep(options, defaults);
    // Ready variable
    this._ready = false;
    // Env variables
    this.dev = this.options.dev;
    // Explicit srcDir, rootDir and buildDir
    this.dir = typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd();
    this.srcDir = typeof options.srcDir === 'string' && options.srcDir ? __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["resolve"])(this.dir, options.srcDir) : this.dir;
    this.buildDir = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["join"])(this.dir, options.buildDir);
    options.rootDir = this.dir;
    options.srcDir = this.srcDir;
    options.buildDir = this.buildDir;
    // If store defined, update store options to true
    if (__WEBPACK_IMPORTED_MODULE_7_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["join"])(this.srcDir, 'store'))) {
      this.options.store = true;
    }
    // If app.html is defined, set the template path to the user template
    this.options.appTemplatePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["resolve"])(__dirname, 'views/app.template.html');
    if (__WEBPACK_IMPORTED_MODULE_7_fs_extra___default.a.existsSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["join"])(this.srcDir, 'app.html'))) {
      this.options.appTemplatePath = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["join"])(this.srcDir, 'app.html');
    }
    // renderer used by Vue.js (via createBundleRenderer)
    this.renderer = null;
    // For serving static/ files to /
    this.serveStatic = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_14_serve_static___default()(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["resolve"])(this.srcDir, 'static'), this.options.render.static));
    // For serving .nuxt/dist/ files (only when build.publicPath is not an URL)
    this.serveStaticNuxt = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_14_serve_static___default()(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["resolve"])(this.buildDir, 'dist'), {
      maxAge: this.dev ? 0 : '1y' // 1 year in production
    }));
    // gzip middleware for production
    if (!this.dev && this.options.render.gzip) {
      this.gzipMiddleware = __WEBPACK_IMPORTED_MODULE_8_pify___default()(__WEBPACK_IMPORTED_MODULE_6_compression___default()(this.options.render.gzip));
    }
    // Add this.Server Class
    this.Server = __WEBPACK_IMPORTED_MODULE_9__server__["a" /* default */];
    // Add this.build
    __WEBPACK_IMPORTED_MODULE_11__build__["a" /* options */].call(this); // Add build options
    this.build = __WEBPACK_IMPORTED_MODULE_11__build__["b" /* build */].bind(this);
    // Error template
    this.errorTemplate = __WEBPACK_IMPORTED_MODULE_5_lodash___default.a.template(__WEBPACK_IMPORTED_MODULE_7_fs_extra___default.a.readFileSync(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_15_path__["resolve"])(__dirname, 'views', 'error.html'), 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    });
    // Add this.render and this.renderRoute
    this.render = __WEBPACK_IMPORTED_MODULE_12__render__["a" /* render */].bind(this);
    this.renderRoute = __WEBPACK_IMPORTED_MODULE_12__render__["b" /* renderRoute */].bind(this);
    this.renderAndGetWindow = __WEBPACK_IMPORTED_MODULE_12__render__["c" /* renderAndGetWindow */].bind(this);
    // Add this.generate
    this.generate = __WEBPACK_IMPORTED_MODULE_13__generate__["a" /* default */].bind(this);
    // Add this.utils (tests purpose)
    this.utils = __WEBPACK_IMPORTED_MODULE_16__utils__;
    // Add module integration
    this.module = new __WEBPACK_IMPORTED_MODULE_10__module__["a" /* default */](this);
    // Init nuxt.js
    this._ready = this.ready();
    // Return nuxt.js instance
    return this;
  }

  __WEBPACK_IMPORTED_MODULE_4_babel_runtime_helpers_createClass___default()(Nuxt, [{
    key: 'ready',
    value: function () {
      var _ref = __WEBPACK_IMPORTED_MODULE_2_babel_runtime_helpers_asyncToGenerator___default()(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.mark(function _callee() {
        return __WEBPACK_IMPORTED_MODULE_1_babel_runtime_regenerator___default.a.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this._ready) {
                  _context.next = 4;
                  break;
                }

                _context.next = 3;
                return this._ready;

              case 3:
                return _context.abrupt('return', this);

              case 4:
                _context.next = 6;
                return this.module.ready();

              case 6:
                // Launch build in development but don't wait for it to be finished
                if (this.dev) {
                  this.build();
                } else {
                  __WEBPACK_IMPORTED_MODULE_11__build__["c" /* production */].call(this);
                }
                return _context.abrupt('return', this);

              case 8:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ready() {
        return _ref.apply(this, arguments);
      }

      return ready;
    }()
  }, {
    key: 'close',
    value: function close(callback) {
      var _this = this;

      var promises = [];
      /* istanbul ignore if */
      if (this.webpackDevMiddleware) {
        var p = new __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
          _this.webpackDevMiddleware.close(function () {
            return resolve();
          });
        });
        promises.push(p);
      }
      /* istanbul ignore if */
      if (this.webpackServerWatcher) {
        var _p = new __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default.a(function (resolve, reject) {
          _this.webpackServerWatcher.close(function () {
            return resolve();
          });
        });
        promises.push(_p);
      }
      /* istanbul ignore if */
      if (this.filesWatcher) {
        this.filesWatcher.close();
      }
      /* istanbul ignore if */
      if (this.customFilesWatcher) {
        this.customFilesWatcher.close();
      }
      return __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_promise___default.a.all(promises).then(function () {
        if (typeof callback === 'function') callback();
      });
    }
  }]);

  return Nuxt;
}();

/* harmony default export */ __webpack_exports__["default"] = (Nuxt);

/***/ }),
/* 28 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_typeof__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_typeof___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_typeof__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_object_assign__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_object_assign___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_object_assign__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_webpack__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_webpack___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_webpack__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_vue_server_renderer_client_plugin__ = __webpack_require__(51);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_vue_server_renderer_client_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_vue_server_renderer_client_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_html_webpack_plugin__ = __webpack_require__(43);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_html_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_html_webpack_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_friendly_errors_webpack_plugin__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_friendly_errors_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_friendly_errors_webpack_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_progress_bar_webpack_plugin__ = __webpack_require__(49);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_progress_bar_webpack_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_progress_bar_webpack_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_webpack_bundle_analyzer__ = __webpack_require__(53);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9_webpack_bundle_analyzer___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_9_webpack_bundle_analyzer__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10_offline_plugin__ = __webpack_require__(47);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10_offline_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_10_offline_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11__base_config_js__ = __webpack_require__(14);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_12_path__);
















/*
|--------------------------------------------------------------------------
| Webpack Client Config
|
| Generate public/dist/client-vendor-bundle.js
| Generate public/dist/client-bundle.js
|
| In production, will generate public/dist/style.css
|--------------------------------------------------------------------------
*/
/* harmony default export */ __webpack_exports__["a"] = (function () {
  var config = __WEBPACK_IMPORTED_MODULE_11__base_config_js__["a" /* default */].call(this, { isClient: true });

  // Entry
  config.entry.app = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_12_path__["resolve"])(this.buildDir, 'client.js');

  // Add vendors
  if (this.options.store) {
    config.entry.vendor.push('vuex');
  }
  config.entry.vendor = config.entry.vendor.concat(this.options.build.vendor);

  // Output
  config.output.path = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_12_path__["resolve"])(this.buildDir, 'dist');
  config.output.filename = this.options.build.filenames.app;

  // env object defined in nuxt.config.js
  var env = {};
  __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_3_lodash__["each"])(this.options.env, function (value, key) {
    env['process.env.' + key] = typeof value === 'string' ? __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify___default()(value) : value;
  });
  // Webpack plugins
  config.plugins = (config.plugins || []).concat([
  // Strip comments in Vue code
  new __WEBPACK_IMPORTED_MODULE_4_webpack___default.a.DefinePlugin(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_object_assign___default()(env, {
    'process.env.NODE_ENV': __WEBPACK_IMPORTED_MODULE_2_babel_runtime_core_js_json_stringify___default()(env.NODE_ENV || (this.dev ? 'development' : 'production')),
    'process.BROWSER_BUILD': true,
    'process.SERVER_BUILD': false,
    'process.browser': true,
    'process.server': true
  })),
  // Extract vendor chunks for better caching
  new __WEBPACK_IMPORTED_MODULE_4_webpack___default.a.optimize.CommonsChunkPlugin({
    name: 'vendor',
    filename: this.options.build.filenames.vendor,
    minChunks: function minChunks(module) {
      // A module is extracted into the vendor chunk when...
      return (
        // If it's inside node_modules
        /node_modules/.test(module.context) &&
        // Do not externalize if the request is a CSS file
        !/\.(css|less|scss|sass|styl|stylus)$/.test(module.request)
      );
    }
  }),
  // Extract webpack runtime & manifest
  new __WEBPACK_IMPORTED_MODULE_4_webpack___default.a.optimize.CommonsChunkPlugin({
    name: 'manifest',
    minChunks: Infinity,
    filename: this.options.build.filenames.manifest
  }),
  // Generate output HTML
  new __WEBPACK_IMPORTED_MODULE_6_html_webpack_plugin___default.a({
    template: this.options.appTemplatePath,
    inject: false // <- Resources will be injected using vue server renderer
  }),
  // Generate client manifest json
  new __WEBPACK_IMPORTED_MODULE_5_vue_server_renderer_client_plugin___default.a({
    filename: 'client-manifest.json'
  })]);
  // client bundle progress bar
  config.plugins.push(new __WEBPACK_IMPORTED_MODULE_8_progress_bar_webpack_plugin___default.a());
  // Add friendly error plugin
  if (this.dev) {
    config.plugins.push(new __WEBPACK_IMPORTED_MODULE_7_friendly_errors_webpack_plugin___default.a());
  }
  // Production client build
  if (!this.dev) {
    config.plugins.push(
    // This is needed in webpack 2 for minifying CSS
    new __WEBPACK_IMPORTED_MODULE_4_webpack___default.a.LoaderOptionsPlugin({
      minimize: true
    }),
    // Minify JS
    new __WEBPACK_IMPORTED_MODULE_4_webpack___default.a.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false
      }
    }));
  }
  // Extend config
  if (typeof this.options.build.extend === 'function') {
    this.options.build.extend.call(this, config, {
      dev: this.dev,
      isClient: true
    });
  }
  // Offline-plugin integration
  if (!this.dev && this.options.offline) {
    var offlineOpts = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_typeof___default()(this.options.offline) === 'object' ? this.options.offline : {};
    config.plugins.push(new __WEBPACK_IMPORTED_MODULE_10_offline_plugin___default.a(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_3_lodash__["defaults"])(offlineOpts, {})));
  }
  // Webpack Bundle Analyzer
  if (!this.dev && this.options.build.analyze) {
    var options = {};
    if (__WEBPACK_IMPORTED_MODULE_0_babel_runtime_helpers_typeof___default()(this.options.build.analyze) === 'object') {
      options = this.options.build.analyze;
    }
    config.plugins.push(new __WEBPACK_IMPORTED_MODULE_9_webpack_bundle_analyzer__["BundleAnalyzerPlugin"](options));
  }
  return config;
});

/***/ }),
/* 29 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_json_stringify__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_json_stringify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_json_stringify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_webpack__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_webpack___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_webpack__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_vue_server_renderer_server_plugin__ = __webpack_require__(52);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_vue_server_renderer_server_plugin___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_vue_server_renderer_server_plugin__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_webpack_node_externals__ = __webpack_require__(56);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_webpack_node_externals___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_webpack_node_externals__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__base_config_js__ = __webpack_require__(14);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_path__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_path___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_path__);











/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
/* harmony default export */ __webpack_exports__["a"] = (function () {
  var config = __WEBPACK_IMPORTED_MODULE_5__base_config_js__["a" /* default */].call(this, { isServer: true });

  // env object defined in nuxt.config.js
  var env = {};
  __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_6_lodash__["each"])(this.options.env, function (value, key) {
    env['process.env.' + key] = typeof value === 'string' ? __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_json_stringify___default()(value) : value;
  });

  config = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()(config, {
    target: 'node',
    devtool: this.dev ? 'source-map' : false,
    entry: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(this.buildDir, 'server.js'),
    output: __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()({}, config.output, {
      path: __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_7_path__["resolve"])(this.buildDir, 'dist'),
      filename: 'server-bundle.js',
      libraryTarget: 'commonjs2'
    }),
    performance: {
      hints: false
    },
    externals: [__WEBPACK_IMPORTED_MODULE_4_webpack_node_externals___default()({
      // load non-javascript files with extensions, presumably via loaders
      whitelist: [/\.(?!(?:js|json)$).{1,5}$/i]
    })],
    plugins: (config.plugins || []).concat([new __WEBPACK_IMPORTED_MODULE_3_vue_server_renderer_server_plugin___default.a({
      filename: 'server-bundle.json'
    }), new __WEBPACK_IMPORTED_MODULE_2_webpack___default.a.DefinePlugin(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_object_assign___default()(env, {
      'process.env.NODE_ENV': __WEBPACK_IMPORTED_MODULE_1_babel_runtime_core_js_json_stringify___default()(this.dev ? 'development' : 'production'),
      'process.BROWSER_BUILD': false, // deprecated
      'process.SERVER_BUILD': true, // deprecated
      'process.browser': false,
      'process.server': true
    }))])
  });
  // This is needed in webpack 2 for minifying CSS
  if (!this.dev) {
    config.plugins.push(new __WEBPACK_IMPORTED_MODULE_2_webpack___default.a.LoaderOptionsPlugin({
      minimize: true
    }));
  }

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    this.options.build.extend(config, {
      dev: this.dev,
      isServer: true
    });
  }
  return config;
});

/***/ }),
/* 30 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_json_stringify__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_json_stringify___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_json_stringify__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__helpers__ = __webpack_require__(15);






/* harmony default export */ __webpack_exports__["a"] = (function (_ref) {
  var isClient = _ref.isClient;

  var babelOptions = __WEBPACK_IMPORTED_MODULE_0_babel_runtime_core_js_json_stringify___default()(__webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1_lodash__["defaults"])(this.options.build.babel, {
    presets: ['vue-app'],
    babelrc: false,
    cacheDirectory: !!this.dev
  }));

  // https://github.com/vuejs/vue-loader/blob/master/docs/en/configurations
  var config = {
    postcss: this.options.build.postcss,
    loaders: {
      'js': 'babel-loader?' + babelOptions,
      'css': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'css'),
      'less': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'less', 'less-loader'),
      'sass': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'sass', 'sass-loader?indentedSyntax&?sourceMap'),
      'scss': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'sass', 'sass-loader?sourceMap'),
      'stylus': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'stylus', 'stylus-loader'),
      'styl': __WEBPACK_IMPORTED_MODULE_2__helpers__["a" /* styleLoader */].call(this, 'stylus', 'stylus-loader')
    },
    preserveWhitespace: false,
    extractCSS: __WEBPACK_IMPORTED_MODULE_2__helpers__["b" /* extractStyles */].call(this)
    // Return the config
  };return config;
});

/***/ }),
/* 31 */
/***/ (function(module, exports) {

module.exports = require("ansi-html");

/***/ }),
/* 32 */
/***/ (function(module, exports) {

module.exports = require("autoprefixer");

/***/ }),
/* 33 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/core-js/array/from");

/***/ }),
/* 34 */
/***/ (function(module, exports) {

module.exports = require("babel-runtime/helpers/slicedToArray");

/***/ }),
/* 35 */
/***/ (function(module, exports) {

module.exports = require("chokidar");

/***/ }),
/* 36 */
/***/ (function(module, exports) {

module.exports = require("connect");

/***/ }),
/* 37 */
/***/ (function(module, exports) {

module.exports = require("etag");

/***/ }),
/* 38 */
/***/ (function(module, exports) {

module.exports = require("fresh");

/***/ }),
/* 39 */
/***/ (function(module, exports) {

module.exports = require("friendly-errors-webpack-plugin");

/***/ }),
/* 40 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 41 */
/***/ (function(module, exports) {

module.exports = require("glob");

/***/ }),
/* 42 */
/***/ (function(module, exports) {

module.exports = require("html-minifier");

/***/ }),
/* 43 */
/***/ (function(module, exports) {

module.exports = require("html-webpack-plugin");

/***/ }),
/* 44 */
/***/ (function(module, exports) {

module.exports = require("http");

/***/ }),
/* 45 */
/***/ (function(module, exports) {

module.exports = require("jsdom");

/***/ }),
/* 46 */
/***/ (function(module, exports) {

module.exports = require("memory-fs");

/***/ }),
/* 47 */
/***/ (function(module, exports) {

module.exports = require("offline-plugin");

/***/ }),
/* 48 */
/***/ (function(module, exports) {

module.exports = require("post-compile-webpack-plugin");

/***/ }),
/* 49 */
/***/ (function(module, exports) {

module.exports = require("progress-bar-webpack-plugin");

/***/ }),
/* 50 */
/***/ (function(module, exports) {

module.exports = require("vue-server-renderer");

/***/ }),
/* 51 */
/***/ (function(module, exports) {

module.exports = require("vue-server-renderer/client-plugin");

/***/ }),
/* 52 */
/***/ (function(module, exports) {

module.exports = require("vue-server-renderer/server-plugin");

/***/ }),
/* 53 */
/***/ (function(module, exports) {

module.exports = require("webpack-bundle-analyzer");

/***/ }),
/* 54 */
/***/ (function(module, exports) {

module.exports = require("webpack-dev-middleware");

/***/ }),
/* 55 */
/***/ (function(module, exports) {

module.exports = require("webpack-hot-middleware");

/***/ }),
/* 56 */
/***/ (function(module, exports) {

module.exports = require("webpack-node-externals");

/***/ })
/******/ ]);
//# sourceMappingURL=nuxt.js.map