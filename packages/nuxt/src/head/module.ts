import { resolve } from 'pathe'
import { addComponent, addImportsSources, addPlugin, addTemplate, defineNuxtModule, tryResolveModule } from '@nuxt/kit'
import type { NuxtOptions } from '@nuxt/schema'
import { unheadVueComposablesImports } from '@unhead/vue'
import { distDir } from '../dirs'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule<NuxtOptions['unhead']>({
  meta: {
    name: 'nuxt:meta',
    configKey: 'unhead',
  },
  async setup (options, nuxt) {
    const runtimeDir = resolve(distDir, 'head/runtime')
    const isNuxtV4 = nuxt.options.future?.compatibilityVersion === 4

    // Transpile @unhead/vue
    nuxt.options.build.transpile.push('@unhead/vue')

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
        kebabName: componentName,
      })
    }

    // allow @unhead/vue server composables to be tree-shaken from the client bundle
    if (!nuxt.options.dev) {
      nuxt.options.optimization.treeShake.composables.client['@unhead/vue'] = [
        'useServerHead', 'useServerSeoMeta', 'useServerHeadSafe',
      ]
    }

    const exportPath = resolve(runtimeDir, 'exports', isNuxtV4 ? 'v4' : 'v3')
    nuxt.options.alias['#unhead/exports'] = exportPath
    addImportsSources({
      from: '#app',
      imports: unheadVueComposablesImports['@unhead/vue'],
    })

    // for Nuxt v3 users we will alias `@unhead/vue` to our custom export path so that
    // import { useHead } from '@unhead/vue'
    // will work in a context without the Vue app such as Nuxt plugins and such
    // for Nuxt v4 user should import from #imports
    if (!isNuxtV4) {
      for (const subpath of ['legacy', 'types']) {
        const subpathModule = `@unhead/vue/${subpath}`
        nuxt.options.alias[subpathModule] = await tryResolveModule(subpathModule, nuxt.options.modulesDir) || subpathModule
      }
      nuxt.options.alias['@unhead/vue'] = exportPath
    }

    addTemplate({
      filename: 'unhead-options.mjs',
      async getContents () {
        if (isNuxtV4) {
          return `export default {}`
        }
        const unheadPlugins = await tryResolveModule('unhead/plugins', nuxt.options.modulesDir) || 'unhead/plugins'
        // v1 unhead legacy options
        const disableCapoSorting = !nuxt.options.experimental.headNext
        return `import { DeprecationsPlugin, PromisesPlugin } from ${JSON.stringify(unheadPlugins)};
export default {
  disableCapoSorting: ${disableCapoSorting}
  plugins: [DeprecationsPlugin, PromisesPlugin],
}`
      },
    })

    addTemplate({
      filename: 'unhead.config.mjs',
      getContents () {
        return [
          `export const renderSSRHeadOptions = ${JSON.stringify(options.renderSSRHeadOptions || {})}`,
        ].join('\n')
      },
    })

    // template is only exposed in nuxt context, expose in nitro context as well
    nuxt.hooks.hook('nitro:config', (config) => {
      config.virtual!['#internal/unhead-options.mjs'] = () => nuxt.vfs['#build/unhead-options.mjs']
      config.virtual!['#internal/unhead.config.mjs'] = () => nuxt.vfs['#build/unhead.config.mjs']
    })

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  },
})
