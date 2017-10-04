<% if (middleware) { %>
let files = require.context('@/middleware', false, /^\.\/.*\.(js|ts|coffee)$/)
let filenames = files.keys()

function getModule (filename) {
  let file = files(filename)
  return file.default
    ? file.default
    : file
}
let middleware = {}

// Generate the middleware
for (let filename of filenames) {
  let name = filename.replace(/^\.\//, '').replace(/\.(js|ts|coffee)$/, '')
  middleware[name] = getModule(filename)
}

export default middleware
<% } else { %>export default {}<% } %>
