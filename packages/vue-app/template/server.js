import Vue from 'vue'
import { joinURL, normalizeURL, withQuery } from 'ufo'
<% if (fetch.server) { %>import fetch from 'node-fetch-native'<% } %>
<% if (features.middleware) { %>import middleware from './middleware.js'<% } %>
import {
  <% if (features.asyncData) { %> applyAsyncData,<% } %>
  <% if (features.middleware) { %> middlewareSeries,<% } %>
  <% if (features.middleware && features.layouts) { %> sanitizeComponent,<% } %>
  getMatchedComponents,
  promisify
} from './utils.js'
  <% if (features.fetch) { %>import fetchMixin from './mixins/fetch.server'<% } %>
import { createApp<% if (features.layouts) { %>, NuxtError <% } %> } from './index.js'
import NuxtLink from './components/nuxt-link.server.js' // should be included after ./index.js

<% if (features.fetch) { %>
  // Update serverPrefetch strategy
  Vue.config.optionMergeStrategies.serverPrefetch = Vue.config.optionMergeStrategies.created

  // Fetch mixin
  if (!Vue.__nuxt__fetch__mixin__) {
    Vue.mixin(fetchMixin)
    Vue.__nuxt__fetch__mixin__ = true
  }
<% } %>

<% if (isDev) { %>
if (!Vue.__original_use__) {
    Vue.__original_use__ = Vue.use
    Vue.__install_times__ = 0
    Vue.use = function (plugin, ...args) {
      plugin.__nuxt_external_installed__ = Vue._installedPlugins.includes(plugin)
      return Vue.__original_use__(plugin, ...args)
    }
  }
  if (Vue.__install_times__ === 2) {
    Vue.__install_times__ = 0
    Vue._installedPlugins = Vue._installedPlugins.filter(plugin => {
      return plugin.__nuxt_external_installed__ === true
    })
  }
  Vue.__install_times__++
    <% } %>

      // Component: <NuxtLink>
      Vue.component(NuxtLink.name, NuxtLink)
      <% if (features.componentAliases) { %> Vue.component('NLink', NuxtLink) <% } %>

<% if (fetch.server) { %>if (!global.fetch) { global.fetch = fetch }<% } %>

const noopApp = () => new Vue({ render: h => h('div', { domProps: { id: '<%= globals.id %>' } }) })

const createNext = ssrContext => (opts) => {
  // If static target, render on client-side
  ssrContext.redirected = opts
  if (ssrContext.target === 'static' || !ssrContext.res) {
    ssrContext.nuxt.serverRendered = false
    return
  }
  let fullPath = withQuery(opts.path, opts.query)
  const $config = ssrContext.nuxt.config || {}
  const routerBase = ($config._app && $config._app.basePath) || '<%= router.base %>'
  if (!fullPath.startsWith('http') && (routerBase !== '/' && !fullPath.startsWith(routerBase))) {
    fullPath = joinURL(routerBase, fullPath)
  }
  // Avoid loop redirect
  if (decodeURI(fullPath) === decodeURI(ssrContext.url)) {
    ssrContext.redirected = false
    return
  }
  ssrContext.res.writeHead(opts.status, {
    Location: normalizeURL(fullPath)
  })
  ssrContext.res.end()
}

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.
export default async (ssrContext) => {
  // Create ssrContext.next for simulate next() of beforeEach() when wanted to redirect
  ssrContext.redirected = false
  ssrContext.next = createNext(ssrContext)
  // Used for beforeNuxtRender({ Components, nuxtState })
  ssrContext.beforeRenderFns = []
  // for beforeSerialize(nuxtState)
  ssrContext.beforeSerializeFns = []
  // Nuxt object (window.{{globals.context}}, defaults to window.__NUXT__)
  ssrContext.nuxt = { <% if (features.layouts) { %> layout: 'default', <% } %> data: [], <% if (features.fetch) { %> fetch: { }, <% } %> error: null <%= (store ? ', state: null' : '') %>, serverRendered: true, routePath: ''
}
  <% if (features.fetch) { %>
  ssrContext.fetchCounters = { }
  <% } %>

  // Remove query from url is static target
  <% if (isFullStatic) { %>
  if (ssrContext.url) {
    ssrContext.url = ssrContext.url.split('?')[0]
  }
  <% } %>
  // Public runtime config
  ssrContext.nuxt.config = ssrContext.runtimeConfig.public
if (ssrContext.nuxt.config._app) {
  __webpack_public_path__ = joinURL(ssrContext.nuxt.config._app.cdnURL, ssrContext.nuxt.config._app.assetsPath)
}
// Create the app definition and the instance (created for each request)
const { app, router<%= (store ? ', store' : '') %> } = await createApp(ssrContext, ssrContext.runtimeConfig.private)
const _app = new Vue(app)
// Add ssr route path to nuxt context so we can account for page navigation between ssr and csr
ssrContext.nuxt.routePath = app.context.route.path

  <% if (features.meta) { %>
    // Add meta infos (used in renderer.js)
    ssrContext.meta = _app.$meta()
      <% } %>
  <% if (features.asyncData) { %>
  // Keep asyncData for each matched component in ssrContext (used in app/utils.js via this.$ssrContext)
  ssrContext.asyncData = { }
  <% } %>

  const beforeRender = async () => {
  // Call beforeNuxtRender() methods
  await Promise.all(ssrContext.beforeRenderFns.map(fn => promisify(fn, { Components, nuxtState: ssrContext.nuxt })))

  ssrContext.rendered = () => {
    // Call beforeSerialize() hooks
    ssrContext.beforeSerializeFns.forEach(fn => fn(ssrContext.nuxt))

      <% if (store) { %>
        // Add the state from the vuex store
        ssrContext.nuxt.state = store.state
          <% } %>

      <% if (isFullStatic && store) { %>
      // Stop recording store mutations
      // unsetMutationObserver is only set after all router middleware are evaluated
      if (ssrContext.unsetMutationObserver) {
        ssrContext.unsetMutationObserver()
      }
      <% } %>
    }
}

const renderErrorPage = async () => {
  // Don't server-render the page in static target
  if (ssrContext.target === 'static') {
    ssrContext.nuxt.serverRendered = false
  }
    <% if (features.layouts) { %>
    // Load layout for error page
    const layout = (NuxtError.options || NuxtError).layout
    const errLayout = typeof layout === 'function' ? layout.call(NuxtError, app.context) : layout
    ssrContext.nuxt.layout = errLayout || 'default'
    await _app.loadLayout(errLayout)
    _app.setLayout(errLayout)
      <% } %>
        await beforeRender()
  return _app
}
const render404Page = () => {
  app.context.error({ statusCode: 404, path: ssrContext.url, message: '<%= messages.error_404 %>' })
  return renderErrorPage()
}

  <% if (debug) { %>const s = Date.now() <% } %>

  // Components are already resolved by setContext -> getRouteData (app/utils.js)
  const Components = getMatchedComponents(app.context.route)

  <% if (store) { %>
  /*
  ** Dispatch store nuxtServerInit
  */
  if (store._actions && store._actions.nuxtServerInit) {
      try {
        await store.dispatch('nuxtServerInit', app.context)
      } catch (err) {
        console.debug('Error occurred when calling nuxtServerInit: ', err.message) <%= isTest ? '// eslint-disable-line no-console' : '' %>
      throw err
      }
    }
    // ...If there is a redirect or an error, stop the process
    if (ssrContext.redirected) {
      return noopApp()
    }
    if (ssrContext.nuxt.error) {
      return renderErrorPage()
    }
  <% } %>

  <% if (features.middleware) { %>
  /*
  ** Call global middleware (nuxt.config.js)
  */
  let midd = <%= serialize(router.middleware).replace('middleware(', 'function(') %><%= isTest ? '// eslint-disable-line' : '' %>
    midd = midd.map((name) => {
      if (typeof name === 'function') {
        return name
      }
      if (typeof middleware[name] !== 'function') {
        app.context.error({ statusCode: 500, message: 'Unknown middleware ' + name })
      }
      return middleware[name]
    })
  await middlewareSeries(midd, app.context)
  // ...If there is a redirect or an error, stop the process
  if (ssrContext.redirected) {
    return noopApp()
  }
  if (ssrContext.nuxt.error) {
    return renderErrorPage()
  }
  <% } %>

  <% if (isFullStatic && store) { %>
  // Record store mutations for full-static after nuxtServerInit and Middleware
  ssrContext.nuxt.mutations =[]
  ssrContext.unsetMutationObserver = store.subscribe(m => { ssrContext.nuxt.mutations.push([m.type, m.payload]) })
    <% } %>

  <% if (features.layouts) { %>
  /*
  ** Set layout
  */
  let layout = Components.length ? Components[0].options.layout : NuxtError.layout
  if (typeof layout === 'function') {
    layout = layout(app.context)
  }
  await _app.loadLayout(layout)
  if (ssrContext.nuxt.error) {
    return renderErrorPage()
  }
  layout = _app.setLayout(layout)
  ssrContext.nuxt.layout = _app.layoutName
    <% } %>

  <% if (features.middleware) { %>
  /*
  ** Call middleware (layout + pages)
  */
  midd =[]
    <% if (features.layouts) { %>
      layout = sanitizeComponent(layout)
      if (layout.options.middleware) {
        midd = midd.concat(layout.options.middleware)
      }
  <% } %>
    Components.forEach((Component) => {
      if (Component.options.middleware) {
        midd = midd.concat(Component.options.middleware)
      }
    })
  midd = midd.map((name) => {
    if (typeof name === 'function') {
      return name
    }
    if (typeof middleware[name] !== 'function') {
      app.context.error({ statusCode: 500, message: 'Unknown middleware ' + name })
    }
    return middleware[name]
  })
  await middlewareSeries(midd, app.context)
  // ...If there is a redirect or an error, stop the process
  if (ssrContext.redirected) {
    return noopApp()
  }
  if (ssrContext.nuxt.error) {
    return renderErrorPage()
  }
  <% } %>

  <% if (features.validate) { %>
  /*
  ** Call .validate()
  */
  let isValid = true
  try {
    for (const Component of Components) {
      if (typeof Component.options.validate !== 'function') {
        continue
      }

      isValid = await Component.options.validate(app.context)

      if (!isValid) {
        break
      }
    }
  } catch (validationError) {
    // ...If .validate() threw an error
    app.context.error({
      statusCode: validationError.statusCode || '500',
      message: validationError.message
    })
    return renderErrorPage()
  }

  // ...If .validate() returned false
  if (!isValid) {
    // Render a 404 error page
    return render404Page()
  }
  <% } %>

  // If no Components found, returns 404
  if (!Components.length) {
  return render404Page()
}

  <% if (features.asyncData || features.fetch) { %>
  // Call asyncData & fetch hooks on components matched by the route.
  const asyncDatas = await Promise.all(Components.map((Component) => {
  const promises = []

    <% if (features.asyncData) { %>
    // Call asyncData(context)
    if (Component.options.asyncData && typeof Component.options.asyncData === 'function') {
      const promise = promisify(Component.options.asyncData, app.context)
        .then((asyncDataResult) => {
          ssrContext.asyncData[Component.cid] = asyncDataResult
          applyAsyncData(Component)
          return asyncDataResult
        })
      promises.push(promise)
    } else {
      promises.push(null)
    }
    <% } %>

    <% if (features.fetch) { %>
    // Call fetch(context)
    if (Component.options.fetch && Component.options.fetch.length) {
      promises.push(Component.options.fetch(app.context))
    } else {
      promises.push(null)
    }
    <% } %>

    return Promise.all(promises)
}))

    <% if (debug) { %>if (process.env.DEBUG && asyncDatas.length) console.debug('Data fetching ' + ssrContext.url + ': ' + (Date.now() - s) + 'ms') <% } %>

      // datas are the first row of each
      ssrContext.nuxt.data = asyncDatas.map(r => r[0] || {})
        <% } %>

  // ...If there is a redirect or an error, stop the process
  if (ssrContext.redirected) {
  return noopApp()
}
if (ssrContext.nuxt.error) {
  return renderErrorPage()
}

// Call beforeNuxtRender methods & add store state
await beforeRender()

return _app
}
