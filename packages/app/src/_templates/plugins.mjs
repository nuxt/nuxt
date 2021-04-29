import head from '#app/plugins/head'
import router from '#app/plugins/router'
import vuex from '#app/plugins/vuex'
import legacy from '#app/plugins/legacy'

<% const plugins = app.plugins.filter(p => p.mode === 'all').map(p => p.src) %>
<%= nxt.importSources(plugins) %>

export default [
  head,
  router,
  vuex,
  legacy,
  <%= plugins.map(nxt.importName).join(',\n\t') %>
]
