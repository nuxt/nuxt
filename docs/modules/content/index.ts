import { resolve } from 'path'
import { defineNuxtModule, resolveModule, addServerMiddleware } from '@nuxt/kit'

export default defineNuxtModule({
  name: 'content',
  setup (_, nuxt) {
    const runtimeDir = resolve(__dirname, 'runtime')

    nuxt.hook('nitro:context', (ctx) => {
      ctx.assets.dirs.content = {
        dir: resolve(nuxt.options.rootDir, 'content')
      }
    })

    addServerMiddleware({
      path: '/api/content',
      handler: resolveModule('./api', { paths: runtimeDir })
    })
  }
})
