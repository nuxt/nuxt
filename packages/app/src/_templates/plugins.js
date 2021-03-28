import head from 'nuxt/app/plugins/head'
import router from 'nuxt/app/plugins/router'
import vuex from 'nuxt/app/plugins/vuex'
import legacy from 'nuxt/app/plugins/legacy'

<% const plugins = app.plugins.filter(p => p.mode === 'all').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

export default [
  head,
  router,
  vuex,
  legacy,
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]
