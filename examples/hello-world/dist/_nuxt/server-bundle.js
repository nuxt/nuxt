module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.l = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// identity function for calling harmory imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };

/******/ 	// define getter function for harmory exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		Object.defineProperty(exports, name, {
/******/ 			configurable: false,
/******/ 			enumerable: true,
/******/ 			get: getter
/******/ 		});
/******/ 	};

/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};

/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 21);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

module.exports = require("vue");

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.router = exports.app = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.


var _vue = __webpack_require__(0);

var _vue2 = _interopRequireDefault(_vue);

var _router = __webpack_require__(8);

var _router2 = _interopRequireDefault(_router);

var _App = __webpack_require__(9);

var _App2 = _interopRequireDefault(_App);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create the app instance.
// here we inject the router and store to all child components,
// making them available everywhere as `this.$router` and `this.$store`.
var app = _extends({
  router: _router2.default

}, _App2.default);

exports.app = app;
exports.router = _router2.default;

/***/ },
/* 2 */
/***/ function(module, exports) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMatchedComponents = getMatchedComponents;
exports.flatMapComponents = flatMapComponents;
exports.getContext = getContext;
exports.getLocation = getLocation;
function getMatchedComponents(route) {
  return [].concat.apply([], route.matched.map(function (m) {
    return Object.keys(m.components).map(function (key) {
      return m.components[key];
    });
  }));
}

function flatMapComponents(route, fn) {
  return Array.prototype.concat.apply([], route.matched.map(function (m, index) {
    return Object.keys(m.components).map(function (key) {
      return fn(m.components[key], m.instances[key], m, key, index);
    });
  }));
}

function getContext(context) {
  var ctx = {
    isServer: !!context.isServer,
    isClient: !!context.isClient,

    route: context.to ? context.to : context.route
  };
  ctx.params = ctx.route.params || {};
  ctx.query = ctx.route.query || {};
  if (context.req) ctx.req = context.req;
  if (context.res) ctx.res = context.res;
  return ctx;
}

// Imported from vue-router
function getLocation(base) {
  var path = window.location.pathname;
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length);
  }
  return (path || '/') + window.location.search + window.location.hash;
}

/***/ },
/* 3 */
/***/ function(module, exports) {

module.exports = require("debug");

/***/ },
/* 4 */
/***/ function(module, exports) {

module.exports = require("lodash");

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _error = __webpack_require__(13);

var _error2 = _interopRequireDefault(_error);

var _Loading = __webpack_require__(10);

var _Loading2 = _interopRequireDefault(_Loading);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//
//
//
//
//
//
//
//

exports.default = {
  data: function data() {
    return {
      err: null
    };
  },
  mounted: function mounted() {
    this.$loading = this.$refs.loading;
  },


  methods: {
    error: function error(err) {
      err = err || null;
      this.err = err || null;

      if (this.err && this.$loading && this.$loading.fail) {
        this.$loading.fail();
      }

      return this.err;
    }
  },
  components: {
    NuxtError: _error2.default,
    NuxtLoading: _Loading2.default
  }
};

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
//
//
//
//
//
//
//
//
//

var Vue = __webpack_require__(0);

exports.default = {
  data: function data() {
    return {
      percent: 0,
      show: false,
      canSuccess: true,
      duration: 5000,
      height: '2px',
      color: 'black',
      failedColor: 'red'
    };
  },

  methods: {
    start: function start() {
      var _this = this;

      this.show = true;
      this.canSuccess = true;
      if (this._timer) {
        clearInterval(this._timer);
        this.percent = 0;
      }
      this._cut = 10000 / Math.floor(this.duration);
      this._timer = setInterval(function () {
        _this.increase(_this._cut * Math.random());
        if (_this.percent > 95) {
          _this.finish();
        }
      }, 100);
      return this;
    },
    set: function set(num) {
      this.show = true;
      this.canSuccess = true;
      this.percent = Math.floor(num);
      return this;
    },
    get: function get() {
      return Math.floor(this.percent);
    },
    increase: function increase(num) {
      this.percent = this.percent + Math.floor(num);
      return this;
    },
    decrease: function decrease() {
      this.percent = this.percent - Math.floor(num);
      return this;
    },
    finish: function finish() {
      this.percent = 100;
      this.hide();
      return this;
    },
    pause: function pause() {
      clearInterval(this._timer);
      return this;
    },
    hide: function hide() {
      var _this2 = this;

      clearInterval(this._timer);
      this._timer = null;
      setTimeout(function () {
        _this2.show = false;
        Vue.nextTick(function () {
          setTimeout(function () {
            _this2.percent = 0;
          }, 200);
        });
      }, 500);
      return this;
    },
    fail: function fail() {
      this.canSuccess = false;
      this.percent = 100;
      this.hide();
      return this;
    }
  }
};

/***/ },
/* 7 */
/***/ function(module, exports) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
//
//
//
//
//
//
//
//
//
//
//
//

exports.default = {
  props: ['error']
};

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _vue = __webpack_require__(0);

var _vue2 = _interopRequireDefault(_vue);

var _vueRouter = __webpack_require__(20);

var _vueRouter2 = _interopRequireDefault(_vueRouter);

var _vueMeta = __webpack_require__(19);

var _vueMeta2 = _interopRequireDefault(_vueMeta);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_vue2.default.use(_vueRouter2.default);
_vue2.default.use(_vueMeta2.default);

var _d30325b8 =  false ? function () {
  return System.import('/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/pages/about.vue');
} : __webpack_require__(11);

var _9393702e =  false ? function () {
  return System.import('/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/pages/index.vue');
} : __webpack_require__(12);

var scrollBehavior = function scrollBehavior(to, from, savedPosition) {
  if (savedPosition) {
    // savedPosition is only available for popstate navigations.
    return savedPosition;
  } else {
    // Scroll to the top by default
    var position = { x: 0, y: 0 };
    // if link has anchor,  scroll to anchor by returning the selector
    if (to.hash) {
      position = { selector: to.hash };
    }
    return position;
  }
};

exports.default = new _vueRouter2.default({
  mode: 'history',
  scrollBehavior: scrollBehavior,
  routes: [{
    path: '/about',
    component: _d30325b8
  }, {
    path: '/',
    component: _9393702e
  }]
});

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* script */
__vue_exports__ = __webpack_require__(5)

/* template */
var __vue_template__ = __webpack_require__(17)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/.nuxt/App.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns
if (__vue_options__.functional) {console.error("[vue-loader] App.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* styles */

/* script */
__vue_exports__ = __webpack_require__(6)

/* template */
var __vue_template__ = __webpack_require__(14)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/.nuxt/components/Loading.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns
__vue_options__._scopeId = "data-v-3223f20f"
if (__vue_options__.functional) {console.error("[vue-loader] Loading.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* styles */

/* template */
var __vue_template__ = __webpack_require__(18)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/pages/about.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns
__vue_options__._scopeId = "data-v-d30325b8"
if (__vue_options__.functional) {console.error("[vue-loader] about.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* styles */

/* template */
var __vue_template__ = __webpack_require__(16)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "/Users/Alexandre/Code/Github/nuxt.js/examples/hello-world/pages/index.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns
__vue_options__._scopeId = "data-v-9393702e"
if (__vue_options__.functional) {console.error("[vue-loader] index.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

var __vue_exports__, __vue_options__
var __vue_styles__ = {}

/* styles */

/* script */
__vue_exports__ = __webpack_require__(7)

/* template */
var __vue_template__ = __webpack_require__(15)
__vue_options__ = __vue_exports__ = __vue_exports__ || {}
if (
  typeof __vue_exports__.default === "object" ||
  typeof __vue_exports__.default === "function"
) {
if (Object.keys(__vue_exports__).some(function (key) { return key !== "default" && key !== "__esModule" })) {console.error("named exports are not supported in *.vue files.")}
__vue_options__ = __vue_exports__ = __vue_exports__.default
}
if (typeof __vue_options__ === "function") {
  __vue_options__ = __vue_options__.options
}
__vue_options__.__file = "/Users/Alexandre/Code/Github/nuxt.js/pages/_error.vue"
__vue_options__.render = __vue_template__.render
__vue_options__.staticRenderFns = __vue_template__.staticRenderFns
__vue_options__._scopeId = "data-v-51a55454"
if (__vue_options__.functional) {console.error("[vue-loader] _error.vue: functional components are not supported and should be defined in plain js files using render functions.")}

module.exports = __vue_exports__


/***/ },
/* 14 */
/***/ function(module, exports) {

module.exports={render:function (){with(this) {
  return _h('div', {
    staticClass: "progress",
    style: ({
      'width': percent + '%',
      'height': height,
      'background-color': canSuccess ? color : failedColor,
      'opacity': show ? 1 : 0
    })
  })
}},staticRenderFns: []}

/***/ },
/* 15 */
/***/ function(module, exports) {

module.exports={render:function (){with(this) {
  return _h('div', {
    staticClass: "error-page"
  }, [_h('div', [_h('h1', {
    staticClass: "error-code"
  }, [_s(error.statusCode)]), " ", _h('div', {
    staticClass: "error-wrapper-message"
  }, [_h('h2', {
    staticClass: "error-message"
  }, [_s(error.message)])]), " ", (error.statusCode === 404) ? _h('p', [_h('router-link', {
    staticClass: "error-link",
    attrs: {
      "to": "/"
    }
  }, ["Back to the home page"])]) : _e()])])
}},staticRenderFns: []}

/***/ },
/* 16 */
/***/ function(module, exports) {

module.exports={render:function (){with(this) {
  return _h('div', {
    staticClass: "container"
  }, [_m(0), " ", _m(1), " ", _h('p', [_h('router-link', {
    attrs: {
      "to": "/about"
    }
  }, ["About"])])])
}},staticRenderFns: [function (){with(this) {
  return _h('img', {
    attrs: {
      "src": "/static/nuxt.png"
    }
  })
}},function (){with(this) {
  return _h('h2', ["Hello World."])
}}]}

/***/ },
/* 17 */
/***/ function(module, exports) {

module.exports={render:function (){with(this) {
  return _h('div', {
    attrs: {
      "id": "app"
    }
  }, [_h('nuxt-loading', {
    ref: "loading"
  }), " ", (!err) ? _h('router-view') : _e(), " ", (err) ? _h('nuxt-error', {
    attrs: {
      "error": err
    }
  }) : _e()])
}},staticRenderFns: []}

/***/ },
/* 18 */
/***/ function(module, exports) {

module.exports={render:function (){with(this) {
  return _h('div', {
    staticClass: "container"
  }, [_m(0), " ", _m(1), " ", _h('p', [_h('router-link', {
    attrs: {
      "to": "/"
    }
  }, ["Home"])])])
}},staticRenderFns: [function (){with(this) {
  return _h('img', {
    attrs: {
      "src": "/static/nuxt.png"
    }
  })
}},function (){with(this) {
  return _h('h2', ["About"])
}}]}

/***/ },
/* 19 */
/***/ function(module, exports) {

module.exports = require("vue-meta");

/***/ },
/* 20 */
/***/ function(module, exports) {

module.exports = require("vue-router");

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

"use strict";
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _vue = __webpack_require__(0);

var _vue2 = _interopRequireDefault(_vue);

var _lodash = __webpack_require__(4);

var _index = __webpack_require__(1);

var _utils = __webpack_require__(2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = __webpack_require__(3)('nuxt:render');


var isDev = false;
var _app = new _vue2.default(_index.app);

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.

exports.default = function (context) {
  // set router's location
  _index.router.push(context.url);

  // Add route to the context
  context.route = _index.router.currentRoute;
  // Add meta infos
  context.meta = _app.$meta();
  // Add store to the context


  // Nuxt object
  context.nuxt = { data: [], error: null };

  // Call data & fecth hooks on components matched by the route.
  var Components = (0, _utils.getMatchedComponents)(context.route);
  if (!Components.length) {
    context.nuxt.error = _app.error({ statusCode: 404, message: 'This page could not be found.', url: context.route.path });

    return Promise.resolve(_app);
  }
  return Promise.all(Components.map(function (Component) {
    var promises = [];
    if (Component.data && typeof Component.data === 'function') {
      Component._data = Component.data;
      var promise = Component.data((0, _utils.getContext)(context));
      if (!(promise instanceof Promise)) promise = Promise.resolve(promise);
      promise.then(function (data) {
        Component.data = function () {
          return data;
        };
      });
      promises.push(promise);
    } else {
      promises.push(null);
    }
    if (Component.fetch) {
      promises.push(Component.fetch((0, _utils.getContext)(context)));
    }
    return Promise.all(promises);
  })).then(function (res) {

    // datas are the first row of each
    context.nuxt.data = res.map(function (tab) {
      return tab[0];
    });

    return _app;
  }).catch(function (error) {
    context.nuxt.error = _app.error(error);

    return _app;
  });
};

/***/ }
/******/ ]);