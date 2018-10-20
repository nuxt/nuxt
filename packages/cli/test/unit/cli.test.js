import { readdir } from 'fs'
import { resolve } from 'path'
import { promisify } from 'util'
import * as commands from '../../src/commands'
import { run } from '../../src'
import { consola } from '../utils'

const readDir = promisify(readdir)

consola.add = jest.fn()

const mockCommand = (cmd, p) => {
  commands[cmd] = jest.fn().mockImplementationOnce(() => { // eslint-disable-line import/namespace
    return Promise.resolve({
      default: () => {
        return p
      }
    })
  })
}

describe('cli', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('exports for all commands defined', async () => {
    const cmds = await readDir(resolve(__dirname, '..', '..', 'src', 'commands'))

    for (let cmd of cmds) {
      cmd = cmd.substring(0, cmd.length - 3)
      if (cmd === 'index') {
        continue
      }

      expect(commands[cmd]).toBeDefined() // eslint-disable-line import/namespace
      expect(typeof commands[cmd]).toBe('function') // eslint-disable-line import/namespace
    }
  })

  test('calls expected method', async () => {
    const argv = process.argv
    process.argv = ['', '', 'dev']
    mockCommand('dev', Promise.resolve())

    await run()

    expect(commands.dev).toHaveBeenCalled()
    process.argv = argv
  })

  test('unknown calls default method', async () => {
    const argv = process.argv
    process.argv = ['', '', 'test']
    mockCommand('dev', Promise.resolve())

    await run()

    expect(commands.dev).toHaveBeenCalled()
    process.argv = argv
  })

  test('sets NODE_ENV=development for dev', async () => {
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = ''
    mockCommand('dev', Promise.resolve())

    await run()

    expect(process.env.NODE_ENV).toBe('development')
    process.env.NODE_ENV = nodeEnv
  })

  test('sets ODE_ENV=production for build', async () => {
    const argv = process.argv
    const nodeEnv = process.env.NODE_ENV
    process.argv = ['', '', 'build']
    process.env.NODE_ENV = ''
    mockCommand('build', Promise.resolve())

    await run()

    expect(process.env.NODE_ENV).toBe('production')
    process.argv = argv
    process.env.NODE_ENV = nodeEnv
  })

  test('catches fatal error', async () => {
    mockCommand('dev', Promise.reject(new Error('Command Error')))

    await run()

    expect(consola.fatal).toHaveBeenCalledWith(new Error('Command Error'))
  })
})
