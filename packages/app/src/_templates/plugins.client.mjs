import { $fetch } from 'ohmyfetch'
import logs from '#app/plugins/logs.client.dev'
import progress from '#app/plugins/progress.client'
<% const plugins = app.plugins.filter(p => p.mode === 'client').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

if (!globalThis.$fetch) {
  globalThis.$fetch = $fetch
}

const plugins = [
  progress,
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]

if (process.dev) {
  plugins.push(logs)
}

export default plugins
