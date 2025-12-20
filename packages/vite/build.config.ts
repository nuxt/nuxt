import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    'src/vite-node',
    'src/vite-node-entry',
  ],
  hooks: {
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  dependencies: [
    'vue',
  ],
  externals: [
    '@nuxt/schema',
  ],
})
