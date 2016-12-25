'use strict'

import Vue from 'vue'
import Meta from 'vue-meta'
import router from './router.js'
<% if (store) { %>import store from './store.js'<% } %>
import NuxtChild from './components/nuxt-child.js'
import NuxtLink from './components/nuxt-link.js'
import Nuxt from './components/nuxt.vue'
import App from '<%= appPath %>'

// Component: <nuxt-child>
Vue.component(NuxtChild.name, NuxtChild)
// Component: <nuxt-link>
Vue.component(NuxtLink.name, NuxtLink)
// Component: <nuxt>
Vue.component(Nuxt.name, Nuxt)

// vue-meta configuration
Vue.use(Meta, {
  keyName: 'head', // the component option name that vue-meta looks for meta info on.
  attribute: 'n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
})

if (process.BROWSER_BUILD) {
  // window.onNuxtReady(() => console.log('Ready')) hook
  // Useful for jsdom testing or plugins (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
  window._nuxtReadyCbs = []
  window.onNuxtReady = function (cb) {
    window._nuxtReadyCbs.push(cb)
  }
}

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
    defaultTransition: defaultTransition,
    transitions: [ defaultTransition ],
    setTransitions (transitions) {
      if (!Array.isArray(transitions)) {
        transitions = [ transitions ]
      }
      transitions = transitions.map((transition) => {
        if (!transition) {
          transition = defaultTransition
        } else if (typeof transition === 'string') {
          transition = Object.assign({}, defaultTransition, { name: transition })
        } else {
          transition = Object.assign({}, defaultTransition, transition)
        }
        return transition
      })
      this.$options._nuxt.transitions = transitions
      return transitions
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
