import { resolve } from 'path'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      input: resolve(__dirname, '../packages/kit/src/config/schema/index'),
      outDir: 'schema',
      name: 'config',
      builder: 'untyped',
      defaults: {
        rootDir: '/project/'
      }
    }
  ]
})
