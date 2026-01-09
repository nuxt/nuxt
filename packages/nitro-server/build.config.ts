import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', ext: 'js' },
  ],
  externals: [
    '@nuxt/schema',
    'nuxt',
    'nitropack',
  ],
})
