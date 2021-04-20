// @ts-ignore
import { createRenderer } from '#nitro-vue-renderer'
const _renderer = createRenderer({})

// @ts-ignore
const __VUE_SSR_CONTEXT__ = global.__VUE_SSR_CONTEXT__ = {}

export function renderToString (component, context) {
  return new Promise((resolve, reject) => {
    _renderer.renderToString(component, context, (err, result) => {
      const styles = [__VUE_SSR_CONTEXT__, context].map(c => c?._styles?.default).filter(Boolean)
      if (!context._styles) { context._styles = {} }
      context._styles.default = {
        ids: [...styles.map(s => s.ids)],
        css: styles.map(s => s.css).join(''),
        media: styles.map(s => s.media).join('')
      }
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}
