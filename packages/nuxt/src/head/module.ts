import { resolve } from 'pathe'
import { addComponent, addImportsSources, addPlugin, defineNuxtModule, tryResolveModule } from '@nuxt/kit'
import { distDir } from '../dirs'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule({
  meta: {
    name: 'meta'
  },
  async setup (options, nuxt) {
    const runtimeDir = resolve(distDir, 'head/runtime')

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
        kebabName: componentName
      })
    }

    // allow @unhead/vue server composables to be tree-shaken from the client bundle
    nuxt.options.optimization.treeShake.composables.client['@unhead/vue'] = [
      'useServerHead', 'useServerSeoMeta', 'useServerHeadSafe'
    ]

    addImportsSources({
      from: '@unhead/vue',
      // hard-coded for now we so don't support auto-imports on the deprecated composables
      imports: [
        'injectHead',
        'useHead',
        'useSeoMeta',
        'useHeadSafe',
        'useServerHead',
        'useServerSeoMeta',
        'useServerHeadSafe'
      ]
    })

    // Opt-out feature allowing dependencies using @vueuse/head to work
    if (nuxt.options.experimental.polyfillVueUseHead) {
      // backwards compatibility
      nuxt.options.alias['@vueuse/head'] = await tryResolveModule('@unhead/vue', nuxt.options.modulesDir) || '@unhead/vue'
      addPlugin({ src: resolve(runtimeDir, 'plugins/vueuse-head-polyfill') })
    }

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  }
})
