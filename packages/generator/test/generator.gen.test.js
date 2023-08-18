import chalk from 'chalk'
import consola from 'consola'
import fsExtra from 'fs-extra'
import { waitFor } from '@nuxt/utils'

import Generator from '../src/generator'
import { createNuxt } from './__utils__'

jest.mock('chalk', () => ({
  red: jest.fn(str => `red:${str}`),
  yellow: jest.fn(str => `yellow:${str}`),
  grey: jest.fn(str => `grey:${str}`)
}))
jest.mock('fs-extra')
jest.mock('@nuxt/utils')

describe('generator: generate routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should generate with build and init by default', async () => {
    const nuxt = createNuxt()
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    const routes = ['routes']
    const errors = ['errors']
    generator.initiate = jest.fn()
    generator.initRoutes = jest.fn(() => routes)
    generator.generateRoutes = jest.fn(() => errors)
    generator.afterGenerate = jest.fn()

    await generator.generate()

    expect(consola.debug).toBeCalledTimes(2)
    expect(consola.debug).nthCalledWith(1, 'Initializing generator...')
    expect(consola.debug).nthCalledWith(2, 'Preparing routes for generate...')
    expect(generator.initiate).toBeCalledTimes(1)
    expect(generator.initiate).toBeCalledWith({ build: true, init: true })
    expect(generator.initRoutes).toBeCalledTimes(1)
    expect(consola.info).toBeCalledTimes(1)
    expect(consola.info).toBeCalledWith('Generating pages')
    expect(generator.generateRoutes).toBeCalledTimes(1)
    expect(generator.generateRoutes).toBeCalledWith(routes, undefined)
    expect(generator.afterGenerate).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:done', generator, errors)
  })

  test('should generate without build and init when disabled', async () => {
    const nuxt = createNuxt()
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    const routes = ['routes']
    const errors = ['errors']
    generator.initiate = jest.fn()
    generator.initRoutes = jest.fn(() => routes)
    generator.generateRoutes = jest.fn(() => errors)
    generator.afterGenerate = jest.fn()

    await generator.generate({ build: false, init: false })

    expect(generator.initiate).toBeCalledTimes(1)
    expect(generator.initiate).toBeCalledWith({ build: false, init: false })
  })

  test('should generate routes', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate = {
      ...nuxt.options.generate,
      concurrency: 2,
      interval: 100
    }
    const routes = [
      { route: '/index', payload: { param: 'test-index' } },
      { route: '/about', payload: { param: 'test-about' } },
      { route: '/foo', payload: { param: 'test-foo' } },
      { route: '/bar', payload: { param: 'test-bar' } },
      { route: '/baz', payload: { param: 'test-baz' } }
    ]
    const generator = new Generator(nuxt)

    generator.generateRoute = jest.fn()

    const errors = await generator.generateRoutes(routes)

    expect(waitFor).toBeCalledTimes(5)
    expect(waitFor).nthCalledWith(1, 0)
    expect(waitFor).nthCalledWith(2, 100)
    expect(waitFor).nthCalledWith(3, 0)
    expect(waitFor).nthCalledWith(4, 100)
    expect(waitFor).nthCalledWith(5, 0)
    expect(generator.generateRoute).toBeCalledTimes(5)
    expect(generator.generateRoute).nthCalledWith(1, { route: '/index', payload: { param: 'test-index' }, errors })
    expect(generator.generateRoute).nthCalledWith(2, { route: '/about', payload: { param: 'test-about' }, errors })
    expect(generator.generateRoute).nthCalledWith(3, { route: '/foo', payload: { param: 'test-foo' }, errors })
    expect(generator.generateRoute).nthCalledWith(4, { route: '/bar', payload: { param: 'test-bar' }, errors })
    expect(generator.generateRoute).nthCalledWith(5, { route: '/baz', payload: { param: 'test-baz' }, errors })

    generator._formatErrors = jest.fn()
    errors.toString()

    expect(generator._formatErrors).toBeCalledTimes(1)
    expect(generator._formatErrors).toBeCalledWith(errors)
  })

  test('should return early with errors', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate = {
      ...nuxt.options.generate,
      concurrency: 2,
      interval: 100
    }
    const routes = [
      { route: '/index', payload: { param: 'test-index' } },
      { route: '/about', payload: { param: 'test-about' } },
      { route: '/foo', payload: { param: 'test-foo' } },
      { route: '/bar', payload: { param: 'test-bar' } },
      { route: '/baz', payload: { param: 'test-baz' } }
    ]
    const generator = new Generator(nuxt)

    generator.generateRoute = jest.fn(({ route, payload = {}, errors = [] }) => {
      errors.push({ type: 'unhandled', route, error: new Error('mock error') })
      return false
    })

    const errors = await generator.generateRoutes(routes, 2)

    expect(waitFor).toBeCalledTimes(2)
    expect(waitFor).nthCalledWith(1, 0)
    expect(waitFor).nthCalledWith(2, 100)
    expect(generator.generateRoute).toBeCalledTimes(2)
    expect(generator.generateRoute).nthCalledWith(1, { route: '/index', payload: { param: 'test-index' }, errors })
    expect(generator.generateRoute).nthCalledWith(2, { route: '/about', payload: { param: 'test-about' }, errors })
    expect(errors.length).toBe(2)

    generator._formatErrors = jest.fn()
    errors.toString()

    expect(generator._formatErrors).toBeCalledTimes(1)
    expect(generator._formatErrors).toBeCalledWith(errors)
  })

  test('should format errors', () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    const errors = generator._formatErrors([
      { type: 'handled', route: '/foo', error: 'foo failed' },
      { type: 'unhandled', route: '/bar', error: { stack: 'bar failed' } }
    ])

    expect(chalk.yellow).toBeCalledTimes(1)
    expect(chalk.yellow).toBeCalledWith(' /foo\n\n')
    expect(chalk.red).toBeCalledTimes(1)
    expect(chalk.red).toBeCalledWith(' /bar\n\n')
    expect(chalk.grey).toBeCalledTimes(2)
    expect(chalk.grey).nthCalledWith(1, '"foo failed"\n')
    expect(chalk.grey).nthCalledWith(2, 'bar failed')
    expect(errors).toEqual(`yellow: /foo

grey:"foo failed"

red: /bar

grey:bar failed`)
  })

  test('should write fallback html after generate', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    fsExtra.exists.mockReturnValueOnce(false)

    await generator.afterGenerate()

    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists.mock.calls[0][0]).toBePath(
      '/var/nuxt/generate/fallback.html',
      'C:\\nuxt\\generate\\fallback.html'
    )
    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith('/', { spa: true })
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(expect.any(String), 'rendered html', 'utf8')
    expect(fsExtra.writeFile.mock.calls[0][0]).toBePath(
      '/var/nuxt/generate/fallback.html',
      'C:\\nuxt\\generate\\fallback.html'
    )
  })

  test('should disable writing fallback if fallback is empty or not string', async () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    nuxt.options.generate.fallback = ''
    await generator.afterGenerate()

    nuxt.options.generate.fallback = jest.fn()
    await generator.afterGenerate()

    expect(fsExtra.exists).not.toBeCalled()
    expect(nuxt.server.renderRoute).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })

  test('should disable writing fallback if fallback path is not existed', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    fsExtra.exists.mockReturnValueOnce(true)

    await generator.afterGenerate()

    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists.mock.calls[0][0]).toBePath(
      '/var/nuxt/generate/fallback.html',
      'C:\\nuxt\\generate\\fallback.html'
    )
    expect(nuxt.server.renderRoute).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })

  test('should disable writing fallback if fallback is empty or not string', async () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    nuxt.options.generate.fallback = ''
    await generator.afterGenerate()

    nuxt.options.generate.fallback = jest.fn()
    await generator.afterGenerate()

    expect(fsExtra.exists).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })
})
