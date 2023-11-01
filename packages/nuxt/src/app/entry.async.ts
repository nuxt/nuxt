import type { CreateOptions } from './nuxt'

const entry = import.meta.server
  ? (ctx?: CreateOptions['ssrContext']) => import('#app/entry').then(m => m.default(ctx))
  : () => import('#app/entry').then(m => m.default)

if (import.meta.client) {
  entry()
}

export default entry
