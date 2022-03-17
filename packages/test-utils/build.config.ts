import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  dependencies: [
  ],
  externals: [
    'vitest',
    'playwright',
    'playwright-core',
    'listhen'
  ]
})
