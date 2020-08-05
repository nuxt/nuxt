import consola from 'consola'

import {
  startsWithAlias, startsWithSrcAlias, wp, wChunk,
  relativeTo, defineAlias, isIndexFileAndFolder, getMainModule
} from '../src/resolve'

describe.posix('util: resolve', () => {
  test('should check if path starts with alias', () => {
    expect(startsWithAlias(['/var'])('/var/nuxt/src')).toEqual(true)
  })

  test('should check if path starts with root alias', () => {
    expect(startsWithSrcAlias('@/assets')).toEqual(true)
    expect(startsWithSrcAlias('~/pages')).toEqual(true)
  })

  test('should check if path starts with src alias', () => {
    expect(startsWithSrcAlias('@@/src/assets')).toEqual(true)
    expect(startsWithSrcAlias('~~/src/pages')).toEqual(true)
  })

  test('should return same path in linux', () => {
    expect(wp('/var/nuxt\\ src/')).toEqual('/var/nuxt\\ src/')
  })

  test('should return same path in linux', () => {
    expect(wChunk('nuxt/layout/test')).toEqual('nuxt/layout/test')
  })

  test('should define alias', () => {
    const nuxt = {}
    const server = {
      name: 'nuxt',
      bound: () => 'bound fn',
      test: () => 'test defineAlias'
    }

    defineAlias(nuxt, server, ['name', 'bound'])
    defineAlias(nuxt, server, ['test'], { bind: false, warn: true })

    expect(nuxt.name).toEqual(server.name)
    expect(nuxt.bound).not.toBe(server.bound)
    expect(nuxt.bound()).toEqual('bound fn')
    expect(nuxt.test).toBe(server.test)
    expect(nuxt.test()).toEqual('test defineAlias')
    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith({
      message: '\'test\' is deprecated\'',
      additional: expect.any(String)
    })
  })

  test('should check if given argument is index file or folder', () => {
    expect(isIndexFileAndFolder(['/var/nuxt/plugins/test'])).toEqual(false)
    expect(isIndexFileAndFolder(['/var/nuxt/plugins/test/index.js'])).toEqual(false)
    expect(isIndexFileAndFolder(['/var/nuxt/plugins/test', '/var/nuxt/plugins/test/index.js'])).toEqual(true)
  })

  test('should return main module', () => {
    expect(getMainModule()).toHaveProperty('children', 'exports', 'filename', 'path')
  })

  describe('relativeTo', () => {
    const path1 = '@/foo'
    const path2 = '@/bar'

    test('should resolve alias path', () => {
      expect(relativeTo(path1, path2)).toBe('@/bar')
    })

    test('should keep webpack inline loaders prepended', () => {
      expect(relativeTo(path1, `loader1!loader2!${path2}`))
        .toEqual('loader1!loader2!@/bar')
    })

    test('should check path which is not started with alias', () => {
      expect(relativeTo('/var/nuxt/foo/bar', '/var/nuxt/foo/baz')).toBe('../baz')
    })

    test('should check path which is not started with alias ', () => {
      expect(relativeTo('/var/nuxt/foo', '/var/nuxt/foo/bar')).toBe('./bar')
    })
  })
})
