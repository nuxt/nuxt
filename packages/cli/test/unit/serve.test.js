import { promises as fs } from 'fs'
import { TARGETS } from '@nuxt/utils'
import * as utils from '../../src/utils/'
import { consola, mockNuxt, mockGetNuxtConfig, NuxtCommand } from '../utils'

describe('serve', () => {
  let serve

  beforeAll(async () => {
    serve = await import('../../src/commands/serve').then(m => m.default)
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('has run function', () => {
    expect(typeof serve.run).toBe('function')
  })

  test('error if dist/ does not exists', () => {
    mockGetNuxtConfig({ target: TARGETS.static })
    const cmd = NuxtCommand.from(serve)
    expect(cmd.run()).rejects.toThrow(new Error('Output directory `dist/` does not exists, please use `nuxt generate` before `nuxt start` for static target.'))
  })

  test('no error if dist/ dir exists', async () => {
    mockGetNuxtConfig({ target: TARGETS.static })
    mockNuxt()
    fs.stat = jest.fn().mockImplementationOnce(() => Promise.resolve(({
      isDirectory: () => true
    })))
    fs.readFile = jest.fn().mockImplementationOnce(() => Promise.resolve('HTML here'))
    await NuxtCommand.from(serve).run()
    expect(consola.fatal).not.toHaveBeenCalled()
  })
})
