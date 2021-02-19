import '@nuxt/nitro/dist/runtime/app/nitro.client'
import logs from 'nuxt/app/plugins/logs.client.dev'
import progress from 'nuxt/app/plugins/progress.client'
<% const plugins = app.plugins.filter(p => p.mode === 'client').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

const plugins = [
  progress,
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]

if (process.dev) {
  plugins.push(logs)
}

export default plugins
