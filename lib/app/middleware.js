<% if (middleware) { %>
let files = require.context('@/<%= dir.middleware %>', false, /^\.\/(?!<%= ignorePrefix %>)[^.]+\.(<%= extensions %>)$/)
let filenames = files.keys()

function getModule (filename) {
  const file = files(filename)
  return file.default || file
}
// Generate the middleware
const middleware = filenames.reduce((middleware, filename) => {
  const name = filename.replace(/^\.\//, '').replace(/\.(<%= extensions %>)$/, '')
  middleware[name] = getModule(filename)
  return middleware
}, {})

export default middleware
<% } else { %>export default {}<% } %>
