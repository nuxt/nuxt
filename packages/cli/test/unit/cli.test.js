import { run } from '../../src'
import getCommand from '../../src/commands'

jest.mock('../../src/commands')

describe('cli', () => {
  afterEach(() => jest.resetAllMocks())

  test('calls expected method', async () => {
    const mockedCommand = {
      run: jest.fn(() => Promise.resolve({}))
    }
    getCommand.mockImplementationOnce(() => Promise.resolve(mockedCommand))

    await run()
    expect(mockedCommand.run).toHaveBeenCalled()
  })

  test('sets NODE_ENV=development for dev', async () => {
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = ''

    getCommand.mockImplementationOnce(() => Promise.resolve({}))

    await run(['dev'])
    expect(process.env.NODE_ENV).toBe('development')
    process.env.NODE_ENV = nodeEnv
  })

  test('sets NODE_ENV=production for build', async () => {
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = ''

    getCommand.mockImplementationOnce(() => Promise.resolve({}))

    await run(['', '', 'build'])
    expect(process.env.NODE_ENV).toBe('production')

    process.env.NODE_ENV = nodeEnv
  })
})
