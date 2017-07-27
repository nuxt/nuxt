import 'es6-promise/auto'
import Vue from 'vue'
import Meta from 'vue-meta'
import { createRouter } from './router.js'
import NuxtChild from './components/nuxt-child.js'
import NuxtLink from './components/nuxt-link.js'
import NuxtError from '<%= components.ErrorPage ? components.ErrorPage : "./components/nuxt-error.vue" %>'
import Nuxt from './components/nuxt.vue'
import App from '<%= appPath %>'
import { getContext, getLocation } from './utils'
<% if (store) { %>import { createStore } from './store.js'<% } %>
<% plugins.forEach(plugin => { %>import <%= plugin.name %> from '<%= plugin.name %>'
<% }) %>

// Component: <nuxt-child>
Vue.component(NuxtChild.name, NuxtChild)

// Component: <nuxt-link>
Vue.component(NuxtLink.name, NuxtLink)

// Component: <nuxt>`
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
        return err
      }
    },
    ...App
  }

  const next = ssrContext ? ssrContext.next : location => app.router.push(location)
  let route = router.currentRoute
  if (!ssrContext) {
    const path = getLocation(router.options.base)
    route = router.resolve(path).route
  }
  const ctx = getContext({
    isServer: !!ssrContext,
    isClient: !ssrContext,
    route,
    next,
    error: app._nuxt.error.bind(app),
    <% if(store) { %>store,<%  } %>
    req: ssrContext ? ssrContext.req : undefined,
    res: ssrContext ? ssrContext.res : undefined,
    beforeRenderFns: ssrContext ? ssrContext.beforeRenderFns : undefined
  }, app)

  <% plugins.filter(p => p.ssr).forEach(plugin => { %>
  if (typeof <%= plugin.name %> === 'function') await <%= plugin.name %>(ctx)<% }) %>
  <% if (plugins.filter(p => !p.ssr).length) { %>
  if (process.browser) { <% plugins.filter(p => !p.ssr).forEach(plugin => { %>
    if (typeof <%= plugin.name %> === 'function') await <%= plugin.name %>(ctx)<% }) %>
  }<% } %>

  return {
    app,
    router,
    <% if(store) { %> store <%  } %>
  }
}

export { createApp, NuxtError }
