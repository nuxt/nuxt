import Module from 'module'
import { resolve, join } from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import esm from 'esm'

import { startsWithRootAlias, startsWithSrcAlias } from '@nuxt/utils'

// ★ 6번
export default class Resolver {
  // Resolver 클래스 생성 시 Nuxt 클래스를 인자로 받아옴
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = this.nuxt.options

    // Binds
    this.resolvePath = this.resolvePath.bind(this)
    this.resolveAlias = this.resolveAlias.bind(this)
    this.resolveModule = this.resolveModule.bind(this)
    this.requireModule = this.requireModule.bind(this)

    // ESM Loader
    this.esm = esm(module)
  }

  // 모듈이 존재하는지, 존재한다면 해당 경로 리턴
  resolveModule(path) {
    try {
      // ★☆ 질문 및 테스트
      return Module._resolveFilename(path, {
        paths: this.options.modulesDir
      })
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return undefined
      } else {
        throw error
      }
    }
  }

  // @@/~~, @/~ 루트 알리아스 바꾸어줌
  resolveAlias(path) {
    // @@이나 ~~으로 시작하는지
    if (startsWithRootAlias(path)) {
      // 맞으면 루트 디렉토리와 path의 앞글자 두 개 빼고 스트링 join 함
      return join(this.options.rootDir, path.substr(2))
    }

    // @이나 ~으로 시작하는지
    if (startsWithSrcAlias(path)) {
      // 맞으면 루트 디렉토리와 path의 앞글자 한 개 빼고 스트링 join함
      return join(this.options.srcDir, path.substr(1))
    }

    // path.resolve 함수! 두 인자 합쳐서 절대 경로 리턴함
    return resolve(this.options.srcDir, path)
  }

  // 패스 존재 여부, 패스 알리아스 바꿔줌, resolvedPath가 존재하는지 그저 디렉토리는 아닌지 그리고 확장자 검사
  // ★☆ 질문: 두 번째 인자, 이러한 object를 받아 올 것이지만 일단 초기화는 빈 오브젝트로 하겠다?
  resolvePath(path, { alias, isAlias = alias, module, isModule = module, isStyle } = {}) {
    // TODO: Remove in Nuxt 3
    if (alias) {
      consola.warn('Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.')
    }
    if (module) {
      consola.warn('Using module is deprecated and will be removed in Nuxt 3. Use `isModule` instead.')
    }

    // Fast return in case of path exists
    if (fs.existsSync(path)) {
      return path
    }

    let resolvedPath

    // Try to resolve it as a regular module
    if (isModule !== false) {
      // 모듈이 존재하는지 아닌지 검사
      resolvedPath = this.resolveModule(path)
    }

    // Try to resolve alias
    if (!resolvedPath && isAlias !== false) {
      // @@/~~, @/~ 루트 알리아스 바꾸어줌
      resolvedPath = this.resolveAlias(path)
    }

    // Use path for resolvedPath
    // resolvedPath이 false 이면
    if (!resolvedPath) {
      resolvedPath = path
    }

    let isDirectory

    // Check if resolvedPath exits and is not a directory
    if (fs.existsSync(resolvedPath)) {
      // ★☆ 질문
      // lstatSync: 심볼릭 링크일 때 링크 파일 자체 정보를 확인 -> 이 무슨 말이죠...
      // isDirectory: 해당 경로가 디렉토리인지 여부를 확인 true/false
      isDirectory = fs.lstatSync(resolvedPath).isDirectory()

      if (!isDirectory) {
        return resolvedPath
      }
    }

    const extensions = isStyle ? this.options.styleExtensions : this.options.extensions

    // Check if any resolvedPath.[ext] or resolvedPath/index.[ext] exists
    // resolvedPath.확장자 혹은 resolvedPath/index.[확장자] 존재 여부
    for (const ext of extensions) {
      if (!isDirectory && fs.existsSync(resolvedPath + '.' + ext)) {
        return resolvedPath + '.' + ext
      }

      if (isDirectory && fs.existsSync(resolvedPath + '/index.' + ext)) {
        return resolvedPath + '/index.' + ext
      }
    }

    // If there's no index.[ext] we just return the directory path
    if (isDirectory) {
      return resolvedPath
    }

    // Give up
    // 리턴 안되면 에러 날리겠다
    throw new Error(`Cannot resolve "${path}" from "${resolvedPath}"`)
  }

  // ★☆ 질문: 두 번째 인자, 이러한 object를 받아 올 것이지만 일단 초기화는 빈 오브젝트로 하겠다?
  requireModule(path, { esm, useESM = esm, alias, isAlias = alias, intropDefault, interopDefault = intropDefault } = {}) {
    let resolvedPath = path
    let requiredModule

    // TODO: Remove in Nuxt 3
    if (intropDefault) {
      consola.warn('Using intropDefault is deprecated and will be removed in Nuxt 3. Use `interopDefault` instead.')
    }
    if (alias) {
      consola.warn('Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.')
    }
    if (esm) {
      consola.warn('Using esm is deprecated and will be removed in Nuxt 3. Use `useESM` instead.')
    }

    let lastError

    // Try to resolve path
    try {
      resolvedPath = this.resolvePath(path, { isAlias })
    } catch (e) {
      lastError = e
    }

    // By default use esm only for js, mjs files outside of node_modules
    if (useESM === undefined) {
      // resolvedPath를 테스트 해보았는데 .js나 mjs로 끝나고 && /node_modules/ 가 아닐 경우
      useESM = /.(js|mjs)$/.test(resolvedPath) && !/node_modules/.test(resolvedPath)
    }

    // Try to require
    try {
      if (useESM) {
        // 맞다면, esm으로 모듈 로드함
        requiredModule = this.esm(resolvedPath)
      } else {
        requiredModule = require(resolvedPath)
      }
    } catch (e) {
      lastError = e
    }

    // Interop default
    if (interopDefault !== false && requiredModule && requiredModule.default) {
      requiredModule = requiredModule.default
    }

    // Throw error if failed to require
    if (requiredModule === undefined && lastError) {
      throw lastError
    }

    return requiredModule
  }
}
