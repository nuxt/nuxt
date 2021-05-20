import head from '#app/plugins/head'
import legacy from '#app/plugins/legacy'
import preload from '#app/plugins/preload.server'

<%= utils.importSources(app.plugins.map(p => p.src)) %>

const commonPlugins = [
  head,
  legacy,
  <%= app.plugins.filter(p => !p.mode || p.mode === 'all').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export const clientPluigns = [
  ...commonPlugins,<%= app.plugins.filter(p => p.mode === 'client').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export const serverPluigns = [
  ...commonPlugins,
  preload,
  <%= app.plugins.filter(p => p.mode === 'server').map(p => utils.importName(p.src)).join(',\n  ') %>
]

export default process.client ? clientPluigns : serverPluigns
