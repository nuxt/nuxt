import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  emitCJS: false,
  entries: [
    'src/module',
    { input: 'src/runtime/', outDir: 'dist/runtime', format: 'esm' }
  ],
  externals: [
    'webpack'
  ]
})
