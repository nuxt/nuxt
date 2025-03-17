import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  rollup: {
    emitCJS: true,
  },
  externals: [
    '@vue/language-core',
    'muggle-string',
  ],
})
