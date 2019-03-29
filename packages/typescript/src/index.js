import { exists, readFile, writeJSON } from 'fs-extra'
import consola from 'consola'

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

export async function setupDefaults(tsConfigPath) {
  let contents = ''

  if (await exists(tsConfigPath)) {
    contents = await readFile(tsConfigPath, 'utf-8')
  }

  if (!contents || contents === '{}') {
    consola.info(`Generating ${tsConfigPath.replace(process.cwd(), '')}`)
    await writeJSON(tsConfigPath, defaultTsJsonConfig, { spaces: 2 })
  }
}
