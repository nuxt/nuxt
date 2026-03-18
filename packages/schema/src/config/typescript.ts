import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  typescript: {
    strict: true,
    builder: {
      $resolve: (val) => {
        const validBuilderTypes = new Set(['vite', 'webpack', 'rspack', 'shared'] as const)
        type ValidBuilderType = typeof validBuilderTypes extends Set<infer Option> ? Option : never
        if (typeof val === 'string' && validBuilderTypes.has(val as ValidBuilderType)) {
          return val as ValidBuilderType
        }
        if (val === false) {
          return false
        }
        return null
      },
    },
    hoist: {
      $resolve: (val) => {
        const defaults = [
          // Key nuxt dependencies
          '@unhead/vue',
          '@nuxt/devtools',
          'vue',
          '@vue/runtime-core',
          '@vue/compiler-sfc',
          'vue-router',
          'vue-router/auto-routes',
          '@nuxt/schema',
          'nuxt',
        ]
        return val === false ? [] : (Array.isArray(val) ? val.concat(defaults) : defaults)
      },
    },
    includeWorkspace: false,
    typeCheck: false,
    tsConfig: {},
    shim: false,
  },
})
