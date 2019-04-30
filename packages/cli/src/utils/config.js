import path from 'path'
import consola from 'consola'
import defaultsDeep from 'lodash/defaultsDeep'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from '@nuxt/config'
import { clearRequireCache, scanRequireTree } from '@nuxt/utils'
import esm from 'esm'

export async function loadNuxtConfig(argv) {
  // 인자로 받은 파일의 절대 경로를 리턴, 이 경우는 process.argv.slice(2)나 현재 파일의 절대 경로
  const rootDir = path.resolve(argv._[0] || '.')
  let nuxtConfigFile
  let options = {}
 
  try {
    // require resolve 경로에서 필요한 파일만 가져옴, 아래 경우 nuxt.config.js임
    nuxtConfigFile = require.resolve(path.resolve(rootDir, argv['config-file']))
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
      // 'config-file'이 없으면, @nuxt/config에서 defaultNuxtConfigFile 가져옴 => 'nuxt.config'임
    } else if (argv['config-file'] !== defaultNuxtConfigFile) {
      consola.fatal('Could not load config file: ' + argv['config-file'])
    }
  }

  // 20190429 여기서 부터
  if (nuxtConfigFile) {
    // Clear cache
    clearRequireCache(nuxtConfigFile)

    // 확장자가 ts로 끝난다면
    if (nuxtConfigFile.endsWith('.ts')) {
      options = require(nuxtConfigFile) || {}
    } else {
      // esm 모듈 로더
      options = esm(module)(nuxtConfigFile) || {}
    }

    // options의 default가 있다면 options는 options의 default가 됨
    if (options.default) {
      options = options.default
    }

    // options가 function이면
    if (typeof options === 'function') {
      try {
        // options 실행 시켜 놓고
        options = await options()
        // 리턴 받은 값에 options.default가 있다면
        if (options.default) {
          // options는 options.default가 됨
          options = options.default
        }
        // 오류 나면 캐치하겠다
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }

    // Keep _nuxtConfigFile for watching
    // options의 nuxtConfigFile에 nuxtConfigFile 을 넣음
    options._nuxtConfigFile = nuxtConfigFile

    // Keep all related files for watching
    // nuxtConfigFile을 scanRequireTree에 넣어서 리턴된 Set을 Array from으로 array로 만들겠다.
    options._nuxtConfigFiles = Array.from(scanRequireTree(nuxtConfigFile))
    // 만약에 nuxtConfigFile이 _nuxtConfigFiles에 includes 아니면
    if (!options._nuxtConfigFiles.includes(nuxtConfigFile)) {
      // array 맨 앞쪽에다가 nuxtConfigFile 넣어줌
      options._nuxtConfigFiles.unshift(nuxtConfigFile)
    }
  }

  // rootDir가 스트링이 아니면
  if (typeof options.rootDir !== 'string') {
    // rootDir에 위에서 선언해준 rootDir 넣어줌
    options.rootDir = rootDir
  }

  // Nuxt Mode
  // && 의 경우 참이면 뒤에꺼, ||의 경우 참이면 맨 앞에꺼 돌려줌
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  // Server options
  // defaultsDeep: 앞에 있는 걸 기준으로, 앞에 없으면 뒤에 있는걸 합쳐줌
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getDefaultNuxtConfig().server) // 서버에 대한 getDefaultNuxtConfig 가져오겠다

  return options
}
