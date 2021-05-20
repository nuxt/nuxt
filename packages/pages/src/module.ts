import { existsSync } from 'fs'
import { defineNuxtModule } from '@nuxt/kit'
import { resolve } from 'upath'
import { resolvePagesRoutes } from './utils'

export default defineNuxtModule({
  name: 'router',
  setup (_options, nuxt) {
    const runtimeDir = resolve(__dirname, 'runtime')
    const pagesDir = resolve(nuxt.options.srcDir, nuxt.options.dir.pages)
    const routerPlugin = resolve(runtimeDir, 'router')

    nuxt.hook('builder:watch', async (event, path) => {
      // Regenerate templates when adding or removing pages (plugin and routes)
      if (event !== 'change' && path.startsWith('pages/')) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    nuxt.hook('app:resolve', (app) => {
      if (!existsSync(pagesDir)) {
        return
      }
      app.plugins.push({ src: routerPlugin })
      if (app.main.includes('app.tutorial')) {
        app.main = resolve(runtimeDir, 'app.vue')
      }
    })

    nuxt.hook('app:templates', async (app) => {
      if (!existsSync(pagesDir)) {
        return
      }

      // Resolve routes
      const routes = await resolvePagesRoutes(nuxt)

      // Add 404 page is not added
      const page404 = routes.find(route => route.name === '404')
      if (!page404) {
        routes.push({
          name: '404',
          path: '/:catchAll(.*)*',
          file: resolve(runtimeDir, '404.vue'),
          children: []
        })
      }

      // Add routes.js
      app.templates.push({
        path: 'routes.js',
        compile: () => {
          const serializedRoutes = routes.map(route => ({ ...route, component: `{() => import('${route.file}')}` }))
          return `export default ${JSON.stringify(serializedRoutes, null, 2).replace(/"{(.+)}"/g, '$1')}`
        }
      })
    })
  }
})
