import preload from '#app/plugins/preload.server'
<% const plugins = app.plugins.filter(p => p.mode === 'server').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

export default [
  preload
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]
