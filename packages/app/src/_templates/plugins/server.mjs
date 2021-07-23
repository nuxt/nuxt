import preload from '#app/plugins/preload.server'

<%= utils.importSources(app.plugins.filter(p => !p.mode || p.mode !== 'client').map(p => p.src)) %>

export default [
  preload,
  <%= app.plugins.filter(p => !p.mode || p.mode !== 'client').map(p => utils.importName(p.src)).join(',\n  ') %>
]
