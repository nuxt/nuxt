import { useNuxt, resolveModule } from '@nuxt/kit'
import { resolve } from 'pathe'
import { distDir } from './dirs'

export function setupAppBridge (_options: any) {
  const nuxt = useNuxt()

  // Setup aliases
  nuxt.options.alias['#app'] = resolve(distDir, 'runtime/index.mjs')
  nuxt.options.alias['#build'] = nuxt.options.buildDir

  // Transpile runtime/
  nuxt.options.build.transpile.push(resolve(distDir, 'runtime'))

  // Alias vue to a vue3-compat version of vue2
  nuxt.options.alias['#vue'] = nuxt.options.alias.vue || resolveModule('vue/dist/vue.runtime.esm.js', { paths: nuxt.options.modulesDir })
  nuxt.options.alias['@vue/shared'] = 'vue'
  nuxt.options.alias['@vue/reactivity'] = 'vue'
  nuxt.options.alias.vue = resolve(distDir, 'runtime/vue.mjs')
  nuxt.options.build.transpile.push('vue')

  // Deprecate various Nuxt options
  if (nuxt.options.globalName !== 'nuxt') {
    throw new Error('Custom global name is not supported by @nuxt/bridge.')
  }

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
