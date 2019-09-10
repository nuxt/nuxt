const middleware = {}
<%= isTest ? '/* eslint-disable dot-notation */' : '' %>
<% for (const m of middleware) {
  // TODO: remove duplicate logic in v3 (see builder.resolveMiddleware)
  const name = m.name || m.src.replace(new RegExp(`\\.(${extensions})$`), '')
  const dst = m.dst || relativeToBuild(srcDir, dir.middleware, m.src)
%>
middleware['<%= name %>'] = require('<%= dst %>')
middleware['<%= name %>'] = middleware['<%= name %>'].default || middleware['<%= name %>']
<% } %>
<%= isTest ? '/* eslint-enable dot-notation */' : '' %>
export default middleware
