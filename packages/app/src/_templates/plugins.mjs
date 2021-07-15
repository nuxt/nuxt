import preload from '#app/plugins/preload.server'

<%= utils.importSources(app.plugins.map(p => p.src)) %>

const commonPlugins = [
  <%= app.plugins.filter(p => !p.mode || p.mode === 'all').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export const clientPlugins = [
  ...commonPlugins,
  <%= app.plugins.filter(p => p.mode === 'client').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export const serverPlugins = [
  ...commonPlugins,
  preload,
  <%= app.plugins.filter(p => p.mode === 'server').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export default process.client ? clientPlugins : serverPlugins
