import { resolve } from 'pathe'
import { addComponent, addPlugin, addVitePlugin, addWebpackPlugin, defineNuxtModule } from '@nuxt/kit'
import UnheadVite from '@unhead/addons/vite'
import UnheadWebpack from '@unhead/addons/webpack'
import { distDir } from '../dirs'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule({
  meta: {
    name: 'meta'
  },
  setup (options, nuxt) {
    const runtimeDir = nuxt.options.alias['#head'] || resolve(distDir, 'head/runtime')

    // Avoid vue dependency issues
    nuxt.options.build.transpile.push('@unhead/vue', 'unhead')

    // backwards compatibility
    nuxt.options.alias['@vueuse/head'] = '@unhead/vue'
    // Add #head alias
    nuxt.options.alias['#head'] = runtimeDir

    // Register components
    const componentsPath = resolve(runtimeDir, 'components')
    for (const componentName of components) {
      addComponent({
        name: componentName,
        filePath: componentsPath,
        export: componentName,
        // kebab case version of these tags is not valid
        kebabName: componentName
      })
    }

    addVitePlugin(UnheadVite(), { build: true })
    addWebpackPlugin(UnheadWebpack(), { build: true })

    addPlugin({ src: resolve(runtimeDir, 'plugin') })
  }
})
