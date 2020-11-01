const _renderToString = require('vue-server-renderer/basic.js')

export function renderToString (component, context) {
  return new Promise((resolve, reject) => {
    _renderToString(component, context, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}
