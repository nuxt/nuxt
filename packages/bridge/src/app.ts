import { useNuxt, addTemplate, resolveAlias, addWebpackPlugin, addVitePlugin } from '@nuxt/kit'
import { NuxtModule } from '@nuxt/schema'
import { resolve } from 'pathe'
import { componentsTypeTemplate } from '../../nuxt3/src/components/templates'
import { schemaTemplate } from '../../nuxt3/src/core/templates'
import { distDir } from './dirs'
import { VueCompat } from './vue-compat'

export function setupAppBridge (_options: any) {
  const nuxt = useNuxt()

  // Setup aliases
  nuxt.options.alias['#app'] = resolve(distDir, 'runtime/index')
  nuxt.options.alias['nuxt3/app'] = nuxt.options.alias['#app']
  nuxt.options.alias['nuxt/app'] = nuxt.options.alias['#app']
  nuxt.options.alias['#build'] = nuxt.options.buildDir

  // Mock `bundleBuilder.build` to support `nuxi prepare`
  if (nuxt.options._prepare) {
    nuxt.hook('builder:prepared', (builder) => {
      builder.bundleBuilder.build = () => Promise.resolve(builder.bundleBuilder)
    })
  }

  // Transpile core vue libraries
  // TODO: resolve in vercel/nft
  nuxt.options.build.transpile.push('vuex')

  // Transpile libs with modern syntax
  nuxt.options.build.transpile.push('h3')

  // Disable legacy fetch polyfills
  nuxt.options.fetch.server = false
  nuxt.options.fetch.client = false

  // Setup types for components
  const components = []
  nuxt.hook('components:extend', (registeredComponents) => {
    components.push(...registeredComponents)
  })
  addTemplate({
    ...componentsTypeTemplate,
    options: { components, buildDir: nuxt.options.buildDir }
  })
  nuxt.hook('prepare:types', ({ references }) => {
    references.push({ path: resolve(nuxt.options.buildDir, 'types/components.d.ts') })
  })

  // Augment schema with module types
  nuxt.hook('modules:done', async (container: any) => {
    nuxt.options._installedModules = await Promise.all(Object.values(container.requiredModules).map(async (m: { src: string, handler: NuxtModule }) => ({
      meta: await m.handler.getMeta?.(),
      entryPath: resolveAlias(m.src, nuxt.options.alias)
    })))
    addTemplate(schemaTemplate)
  })
  nuxt.hook('prepare:types', ({ references }) => {
    // Add module augmentations directly to NuxtConfig
    references.push({ path: resolve(nuxt.options.buildDir, 'types/schema.d.ts') })
  })

  // Alias vue to have identical vue3 exports
  addWebpackPlugin(VueCompat.webpack({
    src: resolve(distDir, 'runtime/vue2-bridge.mjs')
  }))
  addVitePlugin(VueCompat.vite({
    src: resolve(distDir, 'runtime/vue2-bridge.mjs')
  }))

  nuxt.hook('prepare:types', ({ tsConfig, references }) => {
    // Type 'vue' module with composition API exports
    references.push({ path: resolve(distDir, 'runtime/vue2-bridge.d.ts') })

    // Enable Volar support with vue 2 compat mode
    // @ts-ignore
    tsConfig.vueCompilerOptions = {
      experimentalCompatMode: 2
    }
  })

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
