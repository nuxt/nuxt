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

  // tsConfigPath 즉 tsconfig.json이 있으면, 
  if (await exists(tsConfigPath)) {
    // fs-extra의 readFile tsconfig.json을 utf-8으로 인코딩함
    contents = await readFile(tsConfigPath, 'utf-8')
  }
  
  // 연습☆
  if (!contents || contents === '{}') {
    // process.cwd() 는 current working directory 리턴함
    // 절대 경로 아니고 현재 working 디렉토리에 위의 defaultTsJsonCofig를 리턴하겠다고 콘솔 찍음
    consola.info(`Generating ${tsConfigPath.replace(process.cwd(), '')}`)
    await writeJSON(tsConfigPath, defaultTsJsonConfig, { spaces: 2 })
  }
}
