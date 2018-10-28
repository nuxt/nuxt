import { readdir } from 'fs'
import { resolve } from 'path'
import { promisify } from 'util'
import { consola } from '../utils'
import { run } from '../../src'
import * as commands from '../../src/commands'

const readDir = promisify(readdir)

jest.mock('../../src/commands')

describe('cli', () => {
  afterEach(() => jest.resetAllMocks())

  test('exports for all commands defined', async () => {
    const cmds = await readDir(resolve(__dirname, '..', '..', 'src', 'commands'))

    for (let cmd of cmds) {
      if (cmd === 'index.js') {
        continue
      }
      cmd = cmd.substring(0, cmd.length - 3)

      const cmdFn = commands[cmd] // eslint-disable-line import/namespace
      expect(cmdFn).toBeDefined()
      expect(typeof cmdFn).toBe('function')
    }
  })

  test('calls expected method', async () => {
    const argv = process.argv
    process.argv = ['', '', 'dev']
    const defaultExport = {
      run: jest.fn().mockImplementation(() => Promise.resolve())
    }
    commands.dev.mockImplementationOnce(() => Promise.resolve({ default: defaultExport }))

    await run()

    expect(defaultExport.run).toHaveBeenCalled()
    process.argv = argv
  })

  test('unknown calls default method', async () => {
    const argv = process.argv
    process.argv = ['', '', 'test']
    commands.dev.mockImplementationOnce(() => Promise.resolve())

    await run()

    expect(commands.dev).toHaveBeenCalled()
    process.argv = argv
  })

  test('sets NODE_ENV=development for dev', async () => {
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = ''
    commands.dev.mockImplementationOnce(() => Promise.resolve())

    await run()

    expect(process.env.NODE_ENV).toBe('development')
    process.env.NODE_ENV = nodeEnv
  })

  test('sets NODE_ENV=production for build', async () => {
    const argv = process.argv
    const nodeEnv = process.env.NODE_ENV
    process.argv = ['', '', 'build']
    process.env.NODE_ENV = ''
    commands.build.mockImplementationOnce(() => Promise.resolve())

    await run()

    expect(process.env.NODE_ENV).toBe('production')
    process.argv = argv
    process.env.NODE_ENV = nodeEnv
  })

  test('catches fatal error', async () => {
    commands.dev.mockImplementationOnce(() => Promise.reject(new Error('Command Error')))

    await run()

    expect(consola.fatal).toHaveBeenCalledWith(new Error('Command Error'))
  })
})
