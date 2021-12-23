import { CreateOptions } from '#app'

const entry = process.server
  ? (ctx?: CreateOptions['ssrContext']) => import('#app/bootstrap').then(m => m.default(ctx))
  : () => import('#app/bootstrap').then(m => m.default)

if (process.client) {
  entry()
}

export default entry
