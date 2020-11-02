import { createRenderer } from 'vue-server-renderer/build.prod.js'

const _renderer = createRenderer({})

export function renderToString (component, context) {
  return new Promise((resolve, reject) => {
    _renderer.renderToString(component, context, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}
