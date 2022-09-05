import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  externals: [
    'vitest',
    'jest',
    'playwright',
    'playwright-core',
    'listhen'
  ]
})
