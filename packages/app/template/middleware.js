<% if (middleware) { %>
const files = require.context('@/<%= dir.middleware %>', false, /^\.\/(?!<%= ignorePrefix %>)[^.]+\.(<%= extensions %>)$/)
const filenames = files.keys()

function getModule(filename) {
  const file = files(filename)
  return file.default || file
}
const middleware = {}

// Generate the middleware
for (const filename of filenames) {
  const name = filename.replace(/^\.\//, '').replace(/\.(<%= extensions %>)$/, '')
  middleware[name] = getModule(filename)
}

export default middleware
<% } else { %>export default {}<% } %>
