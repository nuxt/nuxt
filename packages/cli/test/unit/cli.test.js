import { consola } from '../utils'
import { run } from '../../src'
import getCommand from '../../src/commands'

jest.mock('../../src/commands')

describe('cli', () => {
  afterEach(() => jest.resetAllMocks())

  test('calls expected method', async () => {
    const argv = process.argv
    process.argv = ['', '', 'dev']
    const defaultExport = {
      run: jest.fn().mockImplementation(() => Promise.resolve())
    }
    getCommand.mockImplementationOnce(() => Promise.resolve({ default: defaultExport }))
    await run()

    expect(defaultExport.run).toHaveBeenCalled()
    process.argv = argv
  })

  test('sets NODE_ENV=development for dev', async () => {
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = ''
    getCommand.mockImplementationOnce(() => Promise.resolve())
    await run()

    expect(process.env.NODE_ENV).toBe('development')
    process.env.NODE_ENV = nodeEnv
  })

  test('sets NODE_ENV=production for build', async () => {
    const argv = process.argv
    const nodeEnv = process.env.NODE_ENV
    process.argv = ['', '', 'build']
    process.env.NODE_ENV = ''
    getCommand.mockImplementationOnce(() => Promise.resolve())
    await run()

    expect(process.env.NODE_ENV).toBe('production')
    process.argv = argv
    process.env.NODE_ENV = nodeEnv
  })
})
