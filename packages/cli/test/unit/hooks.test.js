import path from 'path'
import { NuxtCommand } from '../utils'

describe('dev', () => {
  let dev

  beforeAll(async () => {
    dev = await import('../../src/commands/dev').then(m => m.default)
  })

  afterEach(() => jest.clearAllMocks())

  test('run:before hook', async () => {
    const hooks = {
      'run:before': jest.fn()
    }

    await NuxtCommand.run(dev, [], hooks)

    expect(hooks['run:before']).toHaveBeenCalledWith({
      argv: [],
      cmd: dev,
      rootDir: path.resolve('.')
    })
  })

  test('run:before hook (custom CLI options & rootDir)', async () => {
    const hooks = {
      'run:before': jest.fn()
    }

    await NuxtCommand.run(dev, ['-p', '3001', 'path/to/project'], hooks)

    expect(hooks['run:before']).toHaveBeenCalledWith({
      argv: ['-p', '3001', 'path/to/project'],
      cmd: dev,
      rootDir: path.resolve('path/to/project')
    })
  })

  test('config hook', async () => {
    const hooks = {
      config: jest.fn()
    }

    await NuxtCommand.run(dev, [], hooks)

    expect(hooks.config).toHaveBeenCalledWith(expect.objectContaining({
      _cli: true
    }))
  })
})
