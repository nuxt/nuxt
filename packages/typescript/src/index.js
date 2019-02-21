import { readJSON, writeJSON } from 'fs-extra'
import { register } from 'ts-node'
import defaultsDeep from 'lodash/defaultsDeep'

export const defaultTsJsonConfig = {
  compilerOptions: {
    target: 'esnext',
    module: 'esnext',
    moduleResolution: 'node',
    lib: [
      'esnext',
      'esnext.asynciterable',
      'dom'
    ],
    esModuleInterop: true,
    experimentalDecorators: true,
    // jsx: 'preserve', // TODO : Mention this option in docs for TSX
    sourceMap: true,
    strict: true,
    noImplicitAny: false,
    noEmit: true,
    baseUrl: '.',
    paths: {
      '~/*': [
        './*'
      ],
      '@/*': [
        './*'
      ]
    },
    types: [
      '@types/node',
      '@nuxt/vue-app'
    ]
  }
}

let _setup = false

export async function setup(options) {
  if (_setup) {
    return
  }
  _setup = true

  if (options.tsConfigPath) {
    const config = await readJSON(options.tsConfigPath)
    await writeJSON(options.tsConfigPath, defaultsDeep(config, defaultTsJsonConfig), { spaces: 2 })
  }

  // https://github.com/TypeStrong/ts-node
  register({
    ...options,
    compilerOptions: {
      module: 'commonjs'
    }
  })
}
