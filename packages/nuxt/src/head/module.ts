import { resolve } from 'pathe'
import { addComponent, addImportsSources, addPlugin, addTemplate, defineNuxtModule, tryResolveModule } from '@nuxt/kit'
import type { NuxtOptions } from '@nuxt/schema'
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

    addImportsSources({
      from: resolve(runtimeDir, 'composables', isNuxtV4 ? 'v4' : 'v3'),
      // hard-coded for now we so don't support auto-imports on the deprecated composables
      imports: [
        'injectHead',
        'useHead',
        'useSeoMeta',
        'useHeadSafe',
        'useServerHead',
        'useServerSeoMeta',
        'useServerHeadSafe',
      ],
    })

    const unheadVue = await tryResolveModule('unhead/plugins', nuxt.options.modulesDir) || 'unhead/plugins'

    addTemplate({
      filename: 'unhead-options.mjs',
      getContents () {
        if (isNuxtV4) {
          return `export default {}`
        }
        // v1 unhead legacy options
        const disableCapoSorting = !nuxt.options.experimental.headNext
        return `import { DeprecationsPlugin, PromisesPlugin } from ${JSON.stringify(unheadVue)};
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
