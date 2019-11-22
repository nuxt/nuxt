import Vue from 'vue'
<% if (features.hookablePlugins) {
%>import Hookable from 'hable'
<%
}

if (features.parallelPlugins) {
%>import { interopDefault } from './utils'

<%
  for (const pluginMode of ['all', 'server', 'client']) {
    const modePlugins = plugins.filter(({ mode }) => mode === pluginMode)
    if (!modePlugins.length) {
      continue
    }

    if (pluginMode === 'all') {
      %>const pluginImports = [
<%
    } else {
      %>pluginImports.concat([
<%
    }

    modePlugins.forEach((plugin, index, array) => {
      const sep = index === (array.length - 1) ? '' : ','
      const space = '  '.repeat(pluginMode === 'all' ? 1 : 2)

      %><%= space %>import('<%= plugin.name %>')<%= sep %> // Source: <%= relativeToBuild(plugin.src) %> (mode: '<%= plugin.mode %>')
<%
    })

    if (pluginMode === 'all') {
      %>]
<%
    } else {
      %>])
<%
    }
  }
} else { %>
<%= isTest ? '/* eslint-disable camelcase */' : '' %>
<% plugins.forEach((plugin) => { %>import <%= plugin.name %> from '<%= plugin.name %>' // Source: <%= relativeToBuild(plugin.src) %> (mode: '<%= plugin.mode %>')
<% }) %>
<%= isTest ? '/* eslint-enable camelcase */' : '' %>
<% } %>

export default async function executePlugins(app<%= store ? ', store' : '' %>) {
  <% if (features.hookablePlugins) { %>
  const hooks = new Hookable()
  <% } %>

  function inject (key, value) {
    if (!key || value === undefined) {
      throw new Error(`inject(key, value) has no ${key ? 'value' : 'key'} provided`)
    }

    key = `$${key}`
    // Add into app
    app[key] = value
    <% if (store) { %>
    // Add into store
    store[key] = app[key]
    <% } %>

    if (Vue.prototype.hasOwnProperty(key)) {
      return
    }

    Object.defineProperty(Vue.prototype, key, {
      get () {
        return this.$root.$options[key]
      }
    })
  }

  <% if (features.parallelPlugins) { %>
  async function loadPlugin (plugin) {
    if (!plugin || typeof plugin !== 'function') {
      return
    }

    let injectPromises = []
    const asyncInject = (key, value) => {
      inject(key, value<%= features.hookablePlugins ? ', hooks' : '' %>)

      <% if (features.hookablePlugins) { %>
      injectPromises.push(hooks.callHook(`injected:${key}`, value))
      <% } %>
    }

    const executePromise = plugin(app.context, asyncInject<%= features.hookablePlugins ? ', hooks' : '' %>)

    if (injectPromises.length) {
      await Promise.all(injectPromises)
    }
    return executePromise
  }

  const plugins = await Promise.all(pluginImports.map(interopDefault))
  await plugins.map(loadPlugin)
  <% } else { %>
  <%= isTest ? '/* eslint-disable camelcase */' : '' %>
  <% plugins.forEach((plugin) => { %>
  <% if (plugin.mode == 'client' || plugin.mode === 'server') { %>
  if (process.<%= plugin.mode %> && typeof <%= plugin.name %> === 'function') {
    await <%= plugin.name %>(app.context, inject<%= features.hookablePlugins ? ', hooks' : '' %>)
  }
  <% } else { %>
  if (typeof <%= plugin.name %> === 'function') {
    await <%= plugin.name %>(app.context, inject<%= features.hookablePlugins ? ', hooks' : '' %>)
  }
  <% } %>
  <% }) %>
  <%= isTest ? '/* eslint-enable camelcase */' : '' %>
  <% } %>

  <% if (features.hookablePlugins) { %>
  await hooks.callHook('loaded')
  await hooks.callHook('done')
  <% } %>
}
