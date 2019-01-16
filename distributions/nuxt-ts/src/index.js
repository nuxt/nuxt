import { existsSync, writeFileSync } from 'fs'
import { register } from 'ts-node'

export function registerTsNode() {
  if (!existsSync('tsconfig.json')) {
    writeFileSync('tsconfig.json', JSON.stringify({
      extends: 'nuxt-ts',
      compilerOptions: {
        baseUrl: '.'
      }
    }, undefined, 2))
  }
  // https://github.com/TypeStrong/ts-node
  register({
    compilerOptions: {
      module: 'commonjs'
    }
  })
}
