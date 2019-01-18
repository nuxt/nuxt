import { resolve } from 'path'
import { existsSync, writeJSONSync } from 'fs-extra'
import { register } from 'ts-node'

export function generateTsConfigIfMissing(rootDir = '.') {
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  if (!existsSync(tsConfigPath)) {
    writeJSONSync(tsConfigPath, {
      extends: 'nuxt-ts',
      compilerOptions: {
        baseUrl: '.'
      }
    }, { spaces: 2 })
  }
}

export function registerTsNode() {
  // https://github.com/TypeStrong/ts-node
  register({
    compilerOptions: {
      module: 'commonjs'
    }
  })
}
