<%= utils.importSources(app.plugins.filter(p => !p.mode || p.mode !== 'server').map(p => p.src)) %>

export default [
  <%= app.plugins.filter(p => !p.mode || p.mode !== 'server').map(p => utils.importName(p.src)).join(',\n  ') %>
]
