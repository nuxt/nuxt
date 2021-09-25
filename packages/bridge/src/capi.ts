import { useNuxt, addPlugin, addPluginTemplate } from '@nuxt/kit'
import { resolve } from 'upath'
import { distDir } from './dirs'

export function setupCAPIBridge (_options: any) {
  const nuxt = useNuxt()

  // Error if `@nuxtjs/composition-api` is added
  if (nuxt.options.buildModules.find(m => m === '@nuxtjs/composition-api' || m === '@nuxtjs/composition-api/module')) {
    throw new Error('Please remove `@nuxtjs/composition-api` from `buildModules` to avoid conflict with bridge.')
  }

  // Add composition-api support
  nuxt.options.alias['@vue/composition-api'] = require.resolve('@vue/composition-api/dist/vue-composition-api.mjs')
  const capiPluginPath = resolve(distDir, 'runtime/capi.plugin.mjs')
  addPluginTemplate({ filename: 'capi.plugin.mjs', src: capiPluginPath })

  // Add support for useNuxtApp
  addPlugin(resolve(distDir, 'runtime/app.plugin.mjs'))

  // Register Composition API before loading the rest of app
  nuxt.hook('webpack:config', (configs) => {
    // @ts-ignore
    configs.forEach(config => config.entry.app.unshift(capiPluginPath))
  })

  // TODO: Add @nuxtjs/composition-api shims
}
