'use strict'

import Vue from 'vue'
import Meta from 'vue-meta'
import router from './router.js'
<% if (store) { %>import store from '~store/index.js'<% } %>
import NuxtContainer from './components/nuxt-container.vue'
import Nuxt from './components/nuxt.vue'
import App from '<%= appPath %>'

// Component: <nuxt-container>
Vue.component(NuxtContainer.name, NuxtContainer)
// Component: <nuxt>
Vue.component(Nuxt.name, Nuxt)

// vue-meta configuration
Vue.use(Meta, {
  keyName: 'head', // the component option name that vue-meta looks for meta info on.
  attribute: 'n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
})

// Includes external plugins
<% plugins.forEach(function (pluginPath) { %>
require('<%= pluginPath %>')
<% }) %>

// root instance
// here we inject the router and store to all child components,
// making them available everywhere as `this.$router` and `this.$store`.
const defaultTransition = <%= JSON.stringify(transition) %>
const app = {
  router,
  <%= (store ? 'store,' : '') %>
  _nuxt: {
    transition: Object.assign({}, defaultTransition),
    setTransition (transition) {
      if (!transition) {
        transition = defaultTransition
      } else if (typeof transition === 'string') {
        transition = Object.assign({}, defaultTransition, { name: transition })
      }
      this.$options._nuxt.transition.name = transition.name
      this.$options._nuxt.transition.mode = transition.mode
      return transition
    },
    err: null,
    error (err) {
      err = err || null
      this.$options._nuxt.err = err;
      return err
    }
  },
  ...App
}

export { app, router<%= (store ? ', store' : '') %> }
