import { $fetch } from 'ohmyfetch'
import _global from '@nuxt/un/runtime/global'
import logs from 'nuxt/app/plugins/logs.client.dev'
import progress from 'nuxt/app/plugins/progress.client'
<% const plugins = app.plugins.filter(p => p.mode === 'client').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

_global.$fetch = $fetch

const plugins = [
  progress,
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]

if (process.dev) {
  plugins.push(logs)
}

export default plugins
