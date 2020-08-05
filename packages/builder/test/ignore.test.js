import path from 'path'
import fs from 'fs-extra'

import Ignore from '../src/ignore'

jest.mock('path')
jest.mock('fs-extra')
jest.mock('ignore', () => () => ({
  add: jest.fn(),
  filter: jest.fn(paths => paths)
}))

describe('builder: Ignore', () => {
  beforeAll(() => {
    path.resolve.mockImplementation((...args) => `resolve(${args.join(', ')})`)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct Ignore', () => {
    jest.spyOn(Ignore.prototype, 'addIgnoresRules').mockImplementation(() => {})

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    expect(Ignore.IGNORE_FILENAME).toEqual('.nuxtignore')
    expect(ignore.rootDir).toEqual('/var/nuxt')
    expect(ignore.addIgnoresRules).toBeCalledTimes(1)

    Ignore.prototype.addIgnoresRules.mockRestore()
  })

  test('should add ignore file', () => {
    jest.spyOn(Ignore.prototype, 'addIgnoresRules')
    jest.spyOn(Ignore.prototype, 'readIgnoreFile').mockReturnValue('')

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    expect(Ignore.IGNORE_FILENAME).toEqual('.nuxtignore')
    expect(ignore.rootDir).toEqual('/var/nuxt')
    expect(ignore.addIgnoresRules).toBeCalledTimes(1)
    expect(ignore.readIgnoreFile).toBeCalledTimes(1)

    Ignore.prototype.addIgnoresRules.mockRestore()
    Ignore.prototype.readIgnoreFile.mockRestore()
  })

  test('should find ignore file', () => {
    fs.existsSync.mockReturnValueOnce(true)
    fs.statSync.mockReturnValueOnce({ isFile: () => true })
    fs.readFileSync.mockReturnValueOnce('pages/ignore.vue')

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt', '.nuxtignore')
    expect(fs.existsSync).toBeCalledTimes(1)
    expect(fs.existsSync).toBeCalledWith('resolve(/var/nuxt, .nuxtignore)')
    expect(fs.statSync).toBeCalledTimes(1)
    expect(fs.statSync).toBeCalledWith('resolve(/var/nuxt, .nuxtignore)')
    expect(ignore.ignoreFile).toEqual('resolve(/var/nuxt, .nuxtignore)')
    expect(fs.readFileSync).toBeCalledTimes(1)
    expect(fs.readFileSync).toBeCalledWith('resolve(/var/nuxt, .nuxtignore)', 'utf8')
    expect(ignore.ignore.add).toBeCalledTimes(1)
    expect(ignore.ignore.add).toBeCalledWith('pages/ignore.vue')

    fs.existsSync.mockClear()
    ignore.findIgnoreFile()
    expect(fs.existsSync).not.toBeCalled()
  })

  test('should only find existed ignore file', () => {
    fs.existsSync.mockReturnValueOnce(false)

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt', '.nuxtignore')
    expect(fs.existsSync).toBeCalledTimes(1)
    expect(fs.existsSync).toBeCalledWith('resolve(/var/nuxt, .nuxtignore)')
    expect(fs.statSync).not.toBeCalled()
    expect(ignore.ignoreFile).toBeUndefined()
    expect(ignore.ignore).toBeUndefined()
  })

  test('should filter ignore files', () => {
    fs.existsSync.mockReturnValueOnce(true)
    fs.statSync.mockReturnValueOnce({ isFile: () => true })
    fs.readFileSync.mockReturnValueOnce('pages/ignore.vue')

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    ignore.filter()
    ignore.filter('pages/ignore.vue')
    const paths = ignore.filter(['pages/ignore.vue', 'layouts/ignore.vue'])

    expect(ignore.ignore.filter).toBeCalledTimes(3)
    expect(ignore.ignore.filter).nthCalledWith(1, [])
    expect(ignore.ignore.filter).nthCalledWith(2, ['pages/ignore.vue'])
    expect(ignore.ignore.filter).nthCalledWith(3, ['pages/ignore.vue', 'layouts/ignore.vue'])
    expect(paths).toEqual(['pages/ignore.vue', 'layouts/ignore.vue'])
  })

  test('should return origin paths if there is no ignorefile', () => {
    fs.existsSync.mockReturnValueOnce(false)

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    const paths = ignore.filter(['pages/ignore.vue', 'layouts/ignore.vue'])

    expect(paths).toEqual(['pages/ignore.vue', 'layouts/ignore.vue'])
  })

  test('should reload ignore', () => {
    fs.existsSync.mockReturnValueOnce(true)
    fs.statSync.mockReturnValueOnce({ isFile: () => true })
    fs.readFileSync.mockReturnValueOnce('pages/ignore.vue')

    const ignore = new Ignore({
      rootDir: '/var/nuxt'
    })

    expect(ignore.ignore).toBeDefined()
    expect(ignore.ignoreFile).toEqual('resolve(/var/nuxt, .nuxtignore)')

    ignore.addIgnoresRules = jest.fn()

    ignore.reload()

    expect(ignore.ignore).toBeUndefined()
    expect(ignore.ignoreFile).toBeUndefined()
    expect(ignore.addIgnoresRules).toBeCalledTimes(1)
  })
})
