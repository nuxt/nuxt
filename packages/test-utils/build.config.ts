import { copyFile } from 'node:fs/promises'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', format: 'esm' }
  ],
  externals: [
    'vitest',
    'jest',
    'playwright',
    'playwright-core',
    'listhen'
  ],
  hooks: {
    async 'build:done' () {
      for (const file of ['LICENSE', 'README.md']) {
        await copyFile(`../../${file}`, `./${file}`)
      }
    }
  }
})
