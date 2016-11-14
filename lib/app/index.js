'use strict'

// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import Meta from 'vue-meta/lib/vue-meta.js' // require the ES2015 lib
import router from './router'
<% if (store && storePath) { %>import store from '<%= storePath %>'<% } %>

Vue.use(Meta, {
  keyName: 'head', // the component option name that vue-meta looks for meta info on.
  attribute: 'n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
})

<% plugins.forEach(function (pluginPath) { %>
require('<%= pluginPath %>')
<% }) %>

import App from './App.vue'
// create the app instance.
// here we inject the router and store to all child components,
// making them available everywhere as `this.$router` and `this.$store`.
const app = {
  router,
  <%= (store ? 'store,' : '') %>
  ...App
}

export { app, router<%= (store ? ', store' : '') %> }
