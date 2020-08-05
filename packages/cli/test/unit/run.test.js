import path from 'path'
import execa from 'execa'
import run from '../../src/run'
import getCommand from '../../src/commands'
import NuxtCommand from '../../src/command'

jest.mock('execa')
jest.mock('../../src/commands')
jest.mock('../../src/command')

describe('run', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    getCommand.mockImplementation(cmd => cmd === 'dev' ? ({ name: 'dev', run: jest.fn() }) : undefined)
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  test('nuxt aliases to nuxt dev', async () => {
    await run([])
    expect(getCommand).toHaveBeenCalledWith('dev')
    expect(NuxtCommand.run).toHaveBeenCalledWith(expect.anything(), [], {})
  })

  test('nuxt --foo aliases to nuxt dev --foo', async () => {
    await run(['--foo'])
    expect(getCommand).toHaveBeenCalledWith('dev')
    expect(NuxtCommand.run).toHaveBeenCalledWith(expect.anything(), ['--foo'], {})
  })

  test('all hooks passed to NuxtCommand', async () => {
    const hooks = { foo: jest.fn() }
    await run([], hooks)

    expect(NuxtCommand.run).toHaveBeenCalledWith(expect.anything(), [], hooks)
  })

  test('nuxt <dir> aliases to nuxt dev <dir>', async () => {
    const rootDir = path.resolve(__dirname, '../fixtures')
    await run([rootDir])
    expect(getCommand).toHaveBeenCalledWith('dev')
    expect(NuxtCommand.run).toHaveBeenCalledWith(expect.anything(), [rootDir], {})
  })

  test('external commands', async () => {
    await run(['custom', 'command', '--args'])

    expect(execa).toHaveBeenCalledWith('nuxt-custom', ['command', '--args'], {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin: process.stdin
    })
  })

  test('throws error if external command not found', async () => {
    execa.mockImplementationOnce(() => {
      const e = new Error()
      e.exitCode = 2
      e.exitName = 'ENOENT'
      throw e
    })

    await expect(run(['custom', 'command', '--args']))
      .rejects.toBe('Command not found: nuxt-custom')
  })

  test('throws error if external command failed', async () => {
    execa.mockImplementationOnce(() => { throw new Error('boo') })

    await expect(run(['custom', 'command', '--args']))
      .rejects.toBe('Failed to run command `nuxt-custom`:\nError: boo')
  })
})
