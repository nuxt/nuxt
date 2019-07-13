import Vue from 'vue'
import Meta from 'vue-meta'
import ClientOnly from 'vue-client-only'
import NoSsr from 'vue-no-ssr'
import { createRouter } from './router.js'
import NuxtChild from './components/nuxt-child.js'
import NuxtError from '<%= components.ErrorPage ? components.ErrorPage : "./components/nuxt-error.vue" %>'
import Nuxt from './components/nuxt.js'
import App from '<%= appPath %>'
import { setContext, getLocation, getRouteData, normalizeError } from './utils'
<% if (store) { %>import { createStore } from './store.js'<% } %>

/* Plugins */
<%= isTest ? '/* eslint-disable camelcase */' : '' %>
<% plugins.forEach((plugin) => { %>import <%= plugin.name %> from '<%= plugin.name %>' // Source: <%= relativeToBuild(plugin.src) %> (mode: '<%= plugin.mode %>')
<% }) %>
<%= isTest ? '/* eslint-enable camelcase */' : '' %>

// Component: <ClientOnly>
Vue.component(ClientOnly.name, ClientOnly)
// TODO: Remove in Nuxt 3: <NoSsr>
Vue.component(NoSsr.name, {
  ...NoSsr,
  render(h, ctx) {
    if (process.client && !NoSsr._warned) {
      NoSsr._warned = true
      console.warn(`<no-ssr> has been deprecated and will be removed in Nuxt 3, please use <client-only> instead`)
    }
    return NoSsr.render(h, ctx)
  }
})

// Component: <NuxtChild>
Vue.component(NuxtChild.name, NuxtChild)
Vue.component('NChild', NuxtChild)

// Component NuxtLink is imported in server.js or client.js

// Component: <Nuxt>`
Vue.component(Nuxt.name, Nuxt)

// vue-meta configuration
Vue.use(Meta, {
  keyName: 'head', // the component option name that vue-meta looks for meta info on.
  attribute: 'data-n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'data-n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
})

const defaultTransition = <%=
  serialize(pageTransition)
  .replace('beforeEnter(', 'function(').replace('enter(', 'function(').replace('afterEnter(', 'function(')
  .replace('enterCancelled(', 'function(').replace('beforeLeave(', 'function(').replace('leave(', 'function(')
  .replace('afterLeave(', 'function(').replace('leaveCancelled(', 'function(').replace('beforeAppear(', 'function(')
  .replace('appear(', 'function(').replace('afterAppear(', 'function(').replace('appearCancelled(', 'function(')
%><%= isTest ? '// eslint-disable-line' : '' %>

async function createApp(ssrContext) {
  const router = await createRouter(ssrContext)

  <% if (store) { %>
  const store = createStore(ssrContext)
  // Add this.$router into store actions/mutations
  store.$router = router
    <% if (mode === 'universal') { %>
  // Fix SSR caveat https://github.com/nuxt/nuxt.js/issues/3757#issuecomment-414689141
  const registerModule = store.registerModule
  store.registerModule = (path, rawModule, options) => registerModule.call(store, path, rawModule, Object.assign({ preserveState: process.client }, options))
    <% } %>
  <% } %>

  // Create Root instance

  // here we inject the router and store to all child components,
  // making them available everywhere as `this.$router` and `this.$store`.
  const app = {
    router,
    <% if (store) { %>store,<%  } %>
    nuxt: {
      defaultTransition,
      transitions: [ defaultTransition ],
      setTransitions(transitions) {
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
        this.$options.nuxt.transitions = transitions
        return transitions
      },
      err: null,
      dateErr: null,
      error(err) {
        err = err || null
        app.context._errored = Boolean(err)
        err = err ? normalizeError(err) : null
        const nuxt = this.nuxt || this.$options.nuxt
        nuxt.dateErr = Date.now()
        nuxt.err = err
        // Used in src/server.js
        if (ssrContext) ssrContext.nuxt.error = err
        return err
      }
    },
    ...App
  }
  <% if (store) { %>
  // Make app available into store via this.app
  store.app = app
  <% } %>
  const next = ssrContext ? ssrContext.next : location => app.router.push(location)
  // Resolve route
  let route
  if (ssrContext) {
    route = router.resolve(ssrContext.url).route
  } else {
    const path = getLocation(router.options.base)
    route = router.resolve(path).route
  }

  // Set context to app.context
  await setContext(app, {
    route,
    next,
    error: app.nuxt.error.bind(app),
    <% if (store) { %>store,<% } %>
    payload: ssrContext ? ssrContext.payload : undefined,
    req: ssrContext ? ssrContext.req : undefined,
    res: ssrContext ? ssrContext.res : undefined,
    beforeRenderFns: ssrContext ? ssrContext.beforeRenderFns : undefined,
    ssrContext
  })

  <% if (plugins.length) { %>
  const inject = function (key, value) {
    if (!key) throw new Error('inject(key, value) has no key provided')
    if (typeof value === 'undefined') throw new Error('inject(key, value) has no value provided')
    key = '$' + key
    // Add into app
    app[key] = value
    <% if (store) { %>
    // Add into store
    store[key] = app[key]
    <% } %>
    // Check if plugin not already installed
    const installKey = '__<%= globals.pluginPrefix %>_' + key + '_installed__'
    if (Vue[installKey]) return
    Vue[installKey] = true
    // Call Vue.use() to install the plugin into vm
    Vue.use(() => {
      if (!Vue.prototype.hasOwnProperty(key)) {
        Object.defineProperty(Vue.prototype, key, {
          get() {
            return this.$root.$options[key]
          }
        })
      }
    })
  }
  <% } %>

  <% if (store) { %>
  if (process.client) {
    // Replace store state before plugins execution
    if (window.<%= globals.context %> && window.<%= globals.context %>.state) {
      store.replaceState(window.<%= globals.context %>.state)
    }
  }
  <% } %>

  // Plugin execution
  <%= isTest ? '/* eslint-disable camelcase */' : '' %>
  <% plugins.forEach((plugin) => { %>
  <% if (plugin.mode == 'client') { %>
  if (process.client && typeof <%= plugin.name %> === 'function') {
    await <%= plugin.name %>(app.context, inject)
  }
  <% } else if (plugin.mode == 'server') { %>
  if (process.server && typeof <%= plugin.name %> === 'function') {
    await <%= plugin.name %>(app.context, inject)
  }
  <% } else { %>
  if (typeof <%= plugin.name %> === 'function') {
    await <%= plugin.name %>(app.context, inject)
  }
  <% } %>
  <% }) %>
  <%= isTest ? '/* eslint-enable camelcase */' : '' %>

  // If server-side, wait for async component to be resolved first
  if (process.server && ssrContext && ssrContext.url) {
    await new Promise((resolve, reject) => {
      router.push(ssrContext.url, resolve, () => {
        // navigated to a different route in router guard
        const unregister = router.afterEach(async (to, from, next) => {
          ssrContext.url = to.fullPath
          app.context.route = await getRouteData(to)
          app.context.params = to.params || {}
          app.context.query = to.query || {}
          unregister()
          resolve()
        })
      })
    })
  }

  return {
    app,
    <% if(store) { %>store,<%  } %>
    router
  }
}

export { createApp, NuxtError }
