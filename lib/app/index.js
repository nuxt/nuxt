'use strict'

import Vue from 'vue'
import Meta from 'vue-meta'
import { createRouter } from './router.js'
<% if (store) { %>import { createStore } from './store.js'<% } %>
import NuxtChild from './components/nuxt-child.js'
import NuxtLink from './components/nuxt-link.js'
import NuxtError from '<%= components.ErrorPage ? components.ErrorPage : "./components/nuxt-error.vue" %>'
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
  attribute: 'data-n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'data-n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
})

const defaultTransition = <%=
  serialize(transition)
  .replace('beforeEnter(', 'function(').replace('enter(', 'function(').replace('afterEnter(', 'function(')
  .replace('enterCancelled(', 'function(').replace('beforeLeave(', 'function(').replace('leave(', 'function(')
  .replace('afterLeave(', 'function(').replace('leaveCancelled(', 'function(')
  %>

export { NuxtError }

export function createApp (ssrContext) {
  const store = createStore()
  const router = createRouter()

  if (process.browser) {
    <% if (store) { %>
    // Replace store state before calling plugins
    if (window.__NUXT__ && window.__NUXT__.state) {
      store.replaceState(window.__NUXT__.state)
    }
    <% } %>
    // window.onNuxtReady(() => console.log('Ready')) hook
    // Useful for jsdom testing or plugins (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
    window._nuxtReadyCbs = []
    window.onNuxtReady = function (cb) {
      window._nuxtReadyCbs.push(cb)
    }
  }

  // root instance
  // here we inject the router and store to all child components,
  // making them available everywhere as `this.$router` and `this.$store`.
  let app = {
    router,
    <%= (store ? 'store,' : '') %>
    ssrContext,
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
      dateErr: null,
      error (err) {
        err = err || null
        if (typeof err === 'string') {
          err = { statusCode: 500, message: err }
        }
        this.$options._nuxt.dateErr = Date.now()
        this.$options._nuxt.err = err;
        return err
      }
    },
    ...App
  }


  // Includes & Inject external plugins
  <% plugins.forEach(function (plugin) {
  if (plugin.ssr) { %>
  <%= (plugin.injectAs ? 'let ' + plugin.injectAs + ' = ' : '') %>require('<%= plugin.src %>')
  <% if (plugin.injectAs) { %>
  <%= plugin.injectAs + ' = ' + plugin.injectAs + '.default || ' + plugin.injectAs %>
  app['<%= plugin.injectAs %>'] = <%= plugin.injectAs %>
  <% }
  } else { %>
  if (process.browser) {
    <%= (plugin.injectAs ? 'let ' + plugin.injectAs + ' = ' : '') %>require('<%= plugin.src %>')
    <% if (plugin.injectAs) { %>
    <%= plugin.injectAs + ' = ' + plugin.injectAs + '.default || ' + plugin.injectAs %>
    app['<%= plugin.injectAs %>'] = <%= plugin.injectAs %>
    <% } %>
  }
  <% }
  }) %>

  return { app, router<%= (store ? ', store' : '') %> }
}
