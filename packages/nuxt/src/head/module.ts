import { resolve } from 'pathe'
import { addComponent, addPlugin, defineNuxtModule, tryResolveModule } from '@nuxt/kit'
import { distDir } from '../dirs'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule({
  meta: {
    name: 'meta'
  },
  setup (options, nuxt) {
    const runtimeDir = nuxt.options.alias['#head'] || resolve(distDir, 'head/runtime')

    // Transpile @unhead/vue
    nuxt.options.build.transpile.push('@unhead/vue')

    // Add #head alias
    nuxt.options.alias['#head'] = runtimeDir

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
    // Opt-out feature allowing dependencies using @vueuse/head to work
    if (nuxt.options.experimental.polyfillVueUseHead) {
      // backwards compatibility
      nuxt.options.alias['@vueuse/head'] = tryResolveModule('@unhead/vue') || '@unhead/vue'
      addPlugin({ src: resolve(runtimeDir, 'lib/vueuse-head-polyfill.plugin') })
    }

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'lib/unhead.plugin') })
  }
})
