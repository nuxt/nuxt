import { useNuxt, resolveModule } from '@nuxt/kit'
import { resolve } from 'upath'
import { distDir } from './dirs'

export function setupAppBridge () {
  const nuxt = useNuxt()

  // Setup aliases
  nuxt.options.alias['#app'] = resolve(distDir, 'runtime/index.mjs')
  nuxt.options.alias['#build'] = nuxt.options.buildDir

  // Resolve to same vue2 path
  nuxt.options.alias.vue = nuxt.options.alias.vue || resolveModule('vue/dist/vue.runtime.esm.js', { paths: nuxt.options.modulesDir })

  // Transpile runtime/
  nuxt.options.build.transpile.push(resolve(distDir, 'runtime'))

  // Add composition-api support
  // nuxt.options.alias['@vue/composition-api'] = require.resolve('@vue/composition-api/dist/vue-composition-api.mjs')
  // const capiPluginPath = resolve(distDir, 'runtime/capi.plugin.mjs')
  // addPluginTemplate({ filename: 'capi.plugin.mjs', src: capiPluginPath })
  // nuxt.hook('webpack:config', (configs) => {
  //   // @ts-ignore
  //   configs.forEach(config => config.entry.app.unshift(capiPluginPath))
  // })

  // Fix wp4 esm
  nuxt.hook('webpack:config', (configs) => {
    for (const config of configs.filter(c => c.module)) {
      for (const rule of config.module.rules) {
        // @ts-ignore
        if (rule.test instanceof RegExp && rule.test.test('index.mjs')) {
          // @ts-ignore
          rule.type = 'javascript/auto'
        }
      }
    }
  })
}
