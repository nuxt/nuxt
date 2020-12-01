import consola from 'consola'
import getCommand from '../../src/commands'
import run from '../../src/run'

jest.mock('../../src/commands')

jest.mock('../../package.json', () => ({
  name: '@nuxt/cli-edge'
}))

describe('run in edge', () => {
  test('throws error if nuxt and nuxt-edge are installed', async () => {
    const mockedCommand = { run: jest.fn(() => Promise.resolve({})) }
    getCommand.mockImplementationOnce(() => Promise.resolve(mockedCommand))
    await run()
    expect(consola.warn).toHaveBeenCalledWith('Both `nuxt` and `nuxt-edge` dependencies are installed! Please choose one and remove the other one from dependencies.')
  })
})
