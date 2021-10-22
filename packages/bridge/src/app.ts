import { useNuxt, resolveModule } from '@nuxt/kit'
import { resolve } from 'pathe'
import { distDir } from './dirs'

export function setupAppBridge (_options: any) {
  const nuxt = useNuxt()

  // Setup aliases
  nuxt.options.alias['#app'] = resolve(distDir, 'runtime/index.mjs')
  nuxt.options.alias['#build'] = nuxt.options.buildDir

  // Alias vue to a vue3-compat version of vue2
  nuxt.options.alias['#vue'] = nuxt.options.alias.vue || resolveModule('vue/dist/vue.runtime.esm.js', { paths: nuxt.options.modulesDir })
  for (const alias of [
    // vue 3 helper packages
    '@vue/shared',
    '@vue/reactivity',
    ...[
      // vue 2 dist files
      'vue/dist/vue.common.dev',
      'vue/dist/vue.common',
      'vue/dist/vue.common.prod',
      'vue/dist/vue.esm.browser',
      'vue/dist/vue.esm.browser.min',
      'vue/dist/vue.esm',
      'vue/dist/vue',
      'vue/dist/vue.min',
      'vue/dist/vue.runtime.common.dev',
      'vue/dist/vue.runtime.common',
      'vue/dist/vue.runtime.common.prod',
      'vue/dist/vue.runtime.esm',
      'vue/dist/vue.runtime',
      'vue/dist/vue.runtime.min'
    ].flatMap(m => [m, `${m}.js`])
  ]) {
    nuxt.options.alias[alias] = 'vue'
  }
  nuxt.options.alias.vue = resolve(distDir, 'runtime/vue.mjs')
  nuxt.options.build.transpile.push('vue')

  // Deprecate various Nuxt options
  if (nuxt.options.globalName !== 'nuxt') {
    throw new Error('Custom global name is not supported by @nuxt/bridge.')
  }

  // Fix wp4 esm
  nuxt.hook('webpack:config', (configs) => {
    for (const config of configs.filter(c => c.module)) {
      // @ts-ignore
      const jsRule: any = config.module.rules.find(rule => rule.test instanceof RegExp && rule.test.test('index.mjs'))
      jsRule.type = 'javascript/auto'

      config.module.rules.unshift({
        test: /\.mjs$/,
        type: 'javascript/auto',
        include: [/node_modules/]
      })
    }
  })
}
