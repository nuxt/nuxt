import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import { startsWithRootAlias, startsWithSrcAlias } from '@nuxt/utils'

import Resolver from '../src/resolver'

jest.mock('esm', () => jest.fn(() => jest.fn()))
jest.mock('fs-extra')
jest.mock('@nuxt/utils')

jest.spyOn(path, 'join')
jest.spyOn(path, 'resolve')

describe.posix('core: resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct resolver', () => {
    const nuxt = jest.fn()
    nuxt.options = jest.fn()
    const resolver = new Resolver(nuxt)

    expect(resolver.nuxt).toBe(nuxt)
    expect(resolver.options).toBe(nuxt.options)
    expect(resolver.resolvePath).toBeInstanceOf(Function)
    expect(resolver.resolveAlias).toBeInstanceOf(Function)
    expect(resolver.resolveModule).toBeInstanceOf(Function)
    expect(resolver.requireModule).toBeInstanceOf(Function)
    expect(resolver._require).toEqual(expect.any(Function))
  })

  test('should call require.resolve in resolveModule', () => {
    const resolver = new Resolver({
      options: { modulesDir: '/var/nuxt/node_modules' }
    })
    const resolve = resolver._resolve = jest.fn(() => '/var/nuxt/resolver/module')

    const modulePath = resolver.resolveModule('/var/nuxt/resolver')

    expect(modulePath).toEqual('/var/nuxt/resolver/module')
    expect(resolve).toBeCalledTimes(1)
    expect(resolve).toBeCalledWith('/var/nuxt/resolver', { paths: '/var/nuxt/node_modules' })
  })

  test('should return undefined when module is not found', () => {
    const resolver = new Resolver({
      options: { modulesDir: '/var/nuxt/node_modules' }
    })
    const resolve = resolver._resolve = jest.fn(() => {
      const err = new Error()
      err.code = 'MODULE_NOT_FOUND'
      throw err
    })

    const modulePath = resolver.resolveModule('/var/nuxt/resolver')

    expect(modulePath).toBeUndefined()
    expect(resolve).toBeCalledTimes(1)
  })

  test('should throw error when require.resolve failed', () => {
    const resolver = new Resolver({
      options: { modulesDir: '/var/nuxt/node_modules' }
    })
    resolver._resolve = jest.fn(() => { throw new Error('resolve failed') })

    expect(() => resolver.resolveModule('/var/nuxt/resolver')).toThrow('resolve failed')
  })

  test('should resolve root alias', () => {
    const resolver = new Resolver({
      options: { rootDir: '/var/nuxt' }
    })
    startsWithRootAlias.mockReturnValue(true)

    const aliasPath = { substr: jest.fn(p => String(p)) }
    resolver.resolveAlias(aliasPath)

    expect(path.join).toBeCalledTimes(1)
    expect(path.join).toBeCalledWith('/var/nuxt', '2')
    expect(aliasPath.substr).toBeCalledTimes(1)
    expect(aliasPath.substr).toBeCalledWith(2)
  })

  test('should resolve src alias', () => {
    const resolver = new Resolver({
      options: { srcDir: '/var/nuxt/src' }
    })
    startsWithRootAlias.mockReturnValue(false)
    startsWithSrcAlias.mockReturnValue(true)

    const aliasPath = { substr: jest.fn(p => String(p)) }
    resolver.resolveAlias(aliasPath)

    expect(path.join).toBeCalledTimes(1)
    expect(path.join).toBeCalledWith('/var/nuxt/src', '1')
    expect(aliasPath.substr).toBeCalledTimes(1)
    expect(aliasPath.substr).toBeCalledWith(1)
  })

  test('should resolve other alias', () => {
    const resolver = new Resolver({
      options: { srcDir: '/var/nuxt/src' }
    })
    startsWithRootAlias.mockReturnValue(false)
    startsWithSrcAlias.mockReturnValue(false)

    const aliasPath = 'x'
    resolver.resolveAlias(aliasPath)

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt/src', aliasPath)
  })

  describe('core: resolver resolvePath', () => {
    test('should resolve existed path', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(() => true)

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver/file')

      expect(fs.existsSync).toBeCalledTimes(1)
      expect(fs.existsSync).toBeCalledWith('/var/nuxt/resolver/file')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/file')
    })

    test('should resolve a module path', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/module')
      fs.lstatSync = jest.fn(() => ({ isDirectory: () => false }))
      resolver.resolveModule = jest.fn(() => '/var/nuxt/resolver/module')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver')

      expect(fs.existsSync).toBeCalledTimes(2)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/module')
      expect(fs.lstatSync).toBeCalledTimes(1)
      expect(fs.lstatSync).nthCalledWith(1, '/var/nuxt/resolver/module')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/module')
    })

    test('should resolve a alias path', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/alias')
      fs.lstatSync = jest.fn(() => ({
        isDirectory: () => false
      }))
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver')

      expect(fs.existsSync).toBeCalledTimes(2)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(fs.lstatSync).toBeCalledTimes(1)
      expect(fs.lstatSync).nthCalledWith(1, '/var/nuxt/resolver/alias')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias')
    })

    test('should resolve path with extension', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js']
        }
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/file.js')
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => false)

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver/file')

      expect(fs.existsSync).toBeCalledTimes(3)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver/file')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/file')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/file.js')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/file.js')
    })

    test('should resolve module path with extension', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js']
        }
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/module.js')
      resolver.resolveModule = jest.fn(() => '/var/nuxt/resolver/module')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver/file')

      expect(fs.existsSync).toBeCalledTimes(3)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver/file')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/module')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/module.js')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/module.js')
    })

    test('should resolve alias path with extension', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js']
        }
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/alias.js')
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver/file')

      expect(fs.existsSync).toBeCalledTimes(3)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver/file')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/alias.js')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias.js')
    })

    test('should resolve index.[ext] when path is directory', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js']
        }
      })
      fs.existsSync = jest.fn(path => ['/var/nuxt/resolver/alias', '/var/nuxt/resolver/alias/index.js'].includes(path))
      fs.lstatSync = jest.fn(() => ({ isDirectory: () => true }))
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver')

      expect(fs.existsSync).toBeCalledTimes(3)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/alias/index.js')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias/index.js')
    })

    test('should resolve style path', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js'],
          styleExtensions: ['css', 'scss']
        }
      })
      fs.existsSync = jest.fn(path => ['/var/nuxt/resolver/alias', '/var/nuxt/resolver/alias/index.scss'].includes(path))
      fs.lstatSync = jest.fn(path => ({ isDirectory: () => path === '/var/nuxt/resolver/alias' }))
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver', { isStyle: true })

      expect(fs.existsSync).toBeCalledTimes(4)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/alias/index.css')
      expect(fs.existsSync).nthCalledWith(4, '/var/nuxt/resolver/alias/index.scss')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias/index.scss')
    })

    test('should resolve the directory path if no file', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js', 'vue']
        }
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/alias')
      fs.lstatSync = jest.fn(() => ({ isDirectory: () => true }))
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver')

      expect(fs.existsSync).toBeCalledTimes(4)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(fs.existsSync).nthCalledWith(3, '/var/nuxt/resolver/alias/index.js')
      expect(fs.existsSync).nthCalledWith(4, '/var/nuxt/resolver/alias/index.vue')
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias')
    })

    test('should throw error if no dir and file', () => {
      const resolver = new Resolver({
        options: {
          extensions: ['js', 'vue']
        }
      })
      fs.existsSync = jest.fn(() => false)
      fs.lstatSync = jest.fn(() => ({ isDirectory: () => false }))
      resolver.resolveModule = jest.fn(() => false)
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const errMsg = 'Cannot resolve "/var/nuxt/resolver/file" from "/var/nuxt/resolver/alias"'
      expect(() => resolver.resolvePath('/var/nuxt/resolver/file')).toThrow(errMsg)
    })

    test('should ignore module resolve if isModule is false', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(path => path === '/var/nuxt/resolver/alias')
      resolver.resolveModule = jest.fn(() => '/var/nuxt/resolver/module')
      resolver.resolveAlias = jest.fn(() => '/var/nuxt/resolver/alias')

      const resolvedPath = resolver.resolvePath('/var/nuxt/resolver/file', { isModule: false })

      expect(fs.existsSync).toBeCalledTimes(2)
      expect(fs.existsSync).nthCalledWith(1, '/var/nuxt/resolver/file')
      expect(fs.existsSync).nthCalledWith(2, '/var/nuxt/resolver/alias')
      expect(resolver.resolveModule).not.toBeCalled()
      expect(resolvedPath).toEqual('/var/nuxt/resolver/alias')
    })

    test('should display deprecated alias options', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(() => true)

      resolver.resolvePath('/var/nuxt/resolver/file', { alias: true })
      const warnMsg = 'Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.'
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith(warnMsg)
    })

    test('should display deprecated module options', () => {
      const resolver = new Resolver({
        options: {}
      })
      fs.existsSync = jest.fn(() => true)

      resolver.resolvePath('/var/nuxt/resolver/file.js', { module: true })
      const warnMsg = 'Using module is deprecated and will be removed in Nuxt 3. Use `isModule` instead.'
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith(warnMsg)
    })
  })

  describe('core: resolver resolveModule', () => {
    test('should require es modules with default export', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = x => x
      resolver._require = jest.fn(() => ({ default: 'resolved module' }))

      const resolvedModule = resolver.requireModule('/var/nuxt/resolver/module.js')

      expect(resolvedModule).toEqual('resolved module')
    })

    test('should require es modules without default export', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = x => x
      resolver._require = jest.fn(() => 'resolved module')

      const resolvedModule = resolver.requireModule('/var/nuxt/resolver/module.js')

      expect(resolvedModule).toEqual('resolved module')
    })

    test('should require es modules without default export when interopDefault is disabled', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = x => x
      resolver._require = jest.fn(() => ({ default: 'resolved module' }))

      const resolvedModule = resolver.requireModule('/var/nuxt/resolver/module.js', { interopDefault: false })

      expect(resolvedModule).toEqual({ default: 'resolved module' })
    })

    test('should require common module', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = jest.fn(() => 'path')
      resolver._require = jest.fn(() => ({ default: 'resolved module' }))

      const resolvedModule = resolver.requireModule('path', { useESM: false })

      expect(resolvedModule).toBe(path)
    })

    test('should throw error if resolvePath failed', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = jest.fn(() => { throw new Error('resolve failed') })
      resolver._require = jest.fn(() => undefined)

      expect(() => resolver.requireModule('/var/nuxt/resolver/module.js')).toThrow('resolve failed')
    })

    test('should throw last error', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = jest.fn(() => { throw new Error('resolve failed') })
      resolver._require = jest.fn(() => { throw new Error('resolve esm failed') })

      expect(() => resolver.requireModule('/var/nuxt/resolver/module.js')).toThrow('resolve esm failed')
    })

    test('should display deprecated intropDefault options', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = x => x
      resolver._require = jest.fn()

      resolver.requireModule('/var/nuxt/resolver/file.js', { intropDefault: true })
      const warnMsg = 'Using intropDefault is deprecated and will be removed in Nuxt 3. Use `interopDefault` instead.'
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith(warnMsg)
    })

    test('should display deprecated alias options', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = x => x
      resolver._require = jest.fn()

      resolver.requireModule('/var/nuxt/resolver/file.js', { alias: true })
      const warnMsg = 'Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.'
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith(warnMsg)
    })

    test('should display deprecated esm options', () => {
      const resolver = new Resolver({
        options: {}
      })
      resolver.resolvePath = jest.fn().mockReturnValue('/var/nuxt/resolver/file.js')
      resolver._require = jest.fn()

      resolver.requireModule('/var/nuxt/resolver/file.js', { esm: true })
      const warnMsg = 'Using esm is deprecated and will be removed in Nuxt 3. Use `useESM` instead.'
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith(warnMsg)
    })
  })
})
