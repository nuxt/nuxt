import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    {
      input: 'src/config/schema/index',
      outDir: 'schema',
      name: 'config',
      builder: 'untyped',
      defaults: {
        rootDir: '<rootDir>'
      }
    },
    'src/index'
  ],
  externals: [
    'webpack',
    'nuxt',
    'nuxt3'
  ]
})
