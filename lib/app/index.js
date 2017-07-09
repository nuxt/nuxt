import 'es6-promise/auto'
import Vue from 'vue'
import Meta from 'vue-meta'
import { createRouter } from './router.js'
import NuxtChild from './components/nuxt-child.js'
import NuxtLink from './components/nuxt-link.js'
import NuxtError from '<%= components.ErrorPage ? components.ErrorPage : "./components/nuxt-error.vue" %>'
import Nuxt from './components/nuxt.vue'
import App from '<%= appPath %>'
import { getContext } from './utils'
<% if (store) { %>import { createStore } from './store.js'<% } %>

if (process.browser) {
  // window.onNuxtReady(() => console.log('Ready')) hook
  // Useful for jsdom testing or plugins (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
  window._nuxtReadyCbs = []
  window.onNuxtReady = function (cb) {
    window._nuxtReadyCbs.push(cb)
  }
}

<% if (plugins.filter(p => p.ssr).length) { %>
// Require plugins
<% plugins.filter(p => p.ssr).forEach(plugin => { %>
let <%= plugin.name %> = require('<%= relativeToBuild(plugin.src) %>')
<%= plugin.name %> = <%= plugin.name %>.default || <%= plugin.name %>
<% }) %>
<% } %>

<% if (plugins.filter(p => !p.ssr).length) { %>
// Require browser-only plugins
if (process.browser) {
  <% plugins.filter(p => !p.ssr).forEach(plugin => { %>
  let <%= plugin.name %> = require('<%= relativeToBuild(plugin.src) %>')
  <%= plugin.name %> = <%= plugin.name %>.default || <%= plugin.name %>
  <% }) %>
}
<% } %>


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

async function createApp (ssrContext) {
  const router = createRouter()

  <% if (store) { %>const store = createStore()<% } %>

  if (process.server && ssrContext && ssrContext.url) {
    await new Promise((resolve, reject) => {
      router.push(ssrContext.url, resolve, reject)
    })
  }

  <% if (store) { %>
  if (process.browser) {
    // Replace store state before calling plugins
    if (window.__NUXT__ && window.__NUXT__.state) {
      store.replaceState(window.__NUXT__.state)
    }
  }
  <% } %>

  // Create Root instance
  // here we inject the router and store to all child components,
  // making them available everywhere as `this.$router` and `this.$store`.
  const app = {
    router,
    <% if(store) { %> store,<%  } %> 
    _nuxt: {
      defaultTransition,
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
        const _nuxt = this._nuxt || this.$options._nuxt
        _nuxt.dateErr = Date.now()
        _nuxt.err = err
        console.error(err)
        console.error('[nuxt] ' + err)
        return err
      }
    },
    ...App
  }

  const next = ssrContext ? ssrContext.next : location => app.router.push(location)

  const ctx = getContext({
    isServer: !!ssrContext,
    isClient: !ssrContext,
    route: router.currentRoute,
    next,
    error: app._nuxt.error.bind(app),
    <% if(store) { %> store,<%  } %> 
    req: ssrContext ? ssrContext.req : undefined,
    res: ssrContext ? ssrContext.res : undefined,
  }, app)

  <% if (plugins.filter(p => p.ssr).length) { %>
  <% plugins.filter(p => p.ssr).forEach(plugin => { %>
    if (typeof <%= plugin.name %> === 'function') await <%= plugin.name %>(ctx) 
  <% }) %>
  <% } %>

  <% if (plugins.filter(p => !p.ssr).length) { %>
  if (process.browser) {
    <% plugins.filter(p => !p.ssr).forEach(plugin => { %>
    if (typeof <%= plugin.name %> === 'function') await <%= plugin.name %>(ctx) 
    <% }) %>
  }
  <% } %>

  return {
    app,
    router,
    <% if(store) { %> store <%  } %> 
  }
}

export { createApp, NuxtError }
