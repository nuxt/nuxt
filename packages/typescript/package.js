import { readJSON, writeJSON } from 'fs-extra'

export default {
  build: true,
  hooks: {
    async 'build:done'(pkg) {
      if (pkg.options.suffix && pkg.options.linkedDependencies) {
        const tsconfig = await readJSON(pkg.resolvePath('tsconfig.json'))

        tsconfig.compilerOptions.types = tsconfig.compilerOptions.types.map((type) => {
          const suffix = pkg.options.linkedDependencies.includes(type) ? pkg.options.suffix : ''
          return type + suffix
        })

        await writeJSON(pkg.resolvePath('tsconfig.json'), tsconfig, { spaces: 2 })
      }
    }
  }
}
