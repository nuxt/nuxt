const middleware = {}
<% middleware.forEach(m => {
   const name = m.src.replace(new RegExp(`\\.(${extensions})$`), '')
%>
middleware['<%= name %>'] = require('<%= relativeToBuild(srcDir, dir.middleware, m.src) %>');
middleware['<%= name %>'] = middleware['<%= name %>'].default || middleware['<%= name %>']
<% }) %>
export default middleware
