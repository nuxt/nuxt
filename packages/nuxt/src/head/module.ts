import { resolve } from 'pathe'
import { addComponent, addImportsSources, addPlugin, addVitePlugin, addWebpackPlugin, defineNuxtModule } from '@nuxt/kit'
import UnheadVite from '@unhead/addons/vite'
import UnheadWebpack from '@unhead/addons/webpack'
import type { UnpluginOptions } from '@unhead/addons/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import { distDir } from '../dirs'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule({
  meta: {
    name: 'meta'
  },
  setup (options, nuxt) {
    const runtimeDir = resolve(distDir, 'head/runtime')

    // Avoid vue dependency issues
    nuxt.options.build.transpile.push('@unhead/vue')

    // backwards compatibility
    nuxt.options.alias['@vueuse/head'] = '@unhead/vue'

    // Register components
    const componentsPath = resolve(runtimeDir, 'components')
    for (const componentName of components) {
      addComponent({
        name: componentName,
        filePath: componentsPath,
        export: componentName,
        // built-in that we do not expect the user to override
        priority: 10,
        // kebab case version of these tags is not valid
        kebabName: componentName
      })
    }

    addImportsSources({
      from: '@unhead/vue',
      imports: unheadVueComposablesImports['@unhead/vue']
    })

    const pluginConfig: UnpluginOptions = {
      transformSeoMeta: {
        imports: false
      },
      sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client
    }

    const [, ViteTransformSeoMeta] = UnheadVite(pluginConfig)
    // transforms useSeoMeta -> useHead
    addVitePlugin(ViteTransformSeoMeta, {
      // allow easier debugging if the AST transforms are not working, change once stable
      dev: true,
      build: true,
      server: true,
      client: true
    })

    const [, WebpackTransformSeoMeta] = UnheadWebpack(pluginConfig)
    addWebpackPlugin(WebpackTransformSeoMeta, {
      // allow easier debugging if the AST transforms are not working, change once stable
      dev: true,
      build: true,
      server: true,
      client: true
    })

    addPlugin({ src: resolve(runtimeDir, 'plugin') })
  }
})
