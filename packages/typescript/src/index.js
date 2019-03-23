import { readJSON, writeJSON, pathExistsSync } from 'fs-extra'
import { register } from 'ts-node'

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
    allowJs: true,
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

export async function setup(tsConfigPath, options = {}) {
  if (_setup) {
    return
  }
  _setup = true

  if (pathExistsSync(tsConfigPath)) {
    await readJSON(tsConfigPath)
  } else {
    await writeJSON(tsConfigPath, defaultTsJsonConfig, { spaces: 2 })
  }

  // https://github.com/TypeStrong/ts-node
  register({
    project: tsConfigPath,
    compilerOptions: {
      module: 'commonjs'
    },
    ...options
  })
}
