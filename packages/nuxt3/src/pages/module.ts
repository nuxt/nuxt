import { existsSync } from 'fs'
import { defineNuxtModule, addTemplate, addPlugin } from '@nuxt/kit'
import { resolve } from 'upath'
import { resolveLayouts, resolvePagesRoutes } from './utils'

export default defineNuxtModule({
  name: 'router',
  setup (_options, nuxt) {
    const pagesDir = resolve(nuxt.options.srcDir, nuxt.options.dir.pages)
    const runtimeDir = resolve(__dirname, 'runtime')

    // Disable module if pages dir do not exists
    if (!existsSync(pagesDir)) {
      return
    }

    // Regenerate templates when adding or removing pages
    nuxt.hook('builder:watch', async (event, path) => {
      const pathPattern = new RegExp(`^(${nuxt.options.dir.pages}|${nuxt.options.dir.layouts})/`)
      if (event !== 'change' && path.match(pathPattern)) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    // Add default layout for pages
    nuxt.hook('app:resolve', (app) => {
      if (app.main.includes('app.tutorial')) {
        app.main = resolve(runtimeDir, 'app.vue')
      }
    })

    // Add router plguin
    addPlugin(resolve(runtimeDir, 'router'))

    // Add routes template
    addTemplate({
      filename: 'routes.mjs',
      async getContents () {
        const routes = await resolvePagesRoutes(nuxt)
        const serializedRoutes = routes.map(route => ({ ...route, component: `{() => import('${route.file}')}` }))
        return `export default ${JSON.stringify(serializedRoutes, null, 2).replace(/"{(.+)}"/g, '$1')}`
      }
    })

    // Add layouts template
    addTemplate({
      filename: 'layouts.mjs',
      async getContents () {
        const layouts = await resolveLayouts(nuxt)
        const layoutsObject = Object.fromEntries(layouts.map(({ name, file }) => {
          return [name, `{defineAsyncComponent({ suspensible: false, loader: () => import('${file}') })}`]
        }))
        return [
          'import { defineAsyncComponent } from \'vue\'',
          `export default ${JSON.stringify(layoutsObject, null, 2).replace(/"{(.+)}"/g, '$1')}`
        ].join('\n')
      }
    })
  }
})
