/*!
 * @nuxt/vue-app v2.15.6 (c) 2016-2021
 * Released under the MIT License
 * Repository: https://github.com/nuxt/nuxt.js
 * Website: https://nuxtjs.org
*/
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const path__default = /*#__PURE__*/_interopDefaultLegacy(path);

var dependencies = {
	"node-fetch": "^2.6.6",
	ufo: "^0.7.9",
	unfetch: "^4.2.0",
	vue: "^2.6.14",
	"vue-client-only": "^2.1.0",
	"vue-meta": "^2.4.0",
	"vue-no-ssr": "^1.1.1",
	"vue-router": "^3.5.3",
	"vue-template-compiler": "^2.6.14",
	vuex: "^3.6.2"
};

const template = {
  dependencies,
  dir: path__default["default"].join(__dirname, "..", "template"),
  files: [
    "App.js",
    "client.js",
    "index.js",
    "jsonp.js",
    "router.js",
    "router.scrollBehavior.js",
    "router.extendRoutes.js",
    "routes.json",
    "server.js",
    "utils.js",
    "empty.js",
    "mixins/fetch.server.js",
    "mixins/fetch.client.js",
    "components/nuxt-error.vue",
    "components/nuxt-child.js",
    "components/nuxt-link.server.js",
    "components/nuxt-link.client.js",
    "components/nuxt.js",
    "views/app.template.html",
    "views/error.html"
  ]
};

exports.template = template;
