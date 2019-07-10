import run from '../../src/run'

jest.mock('../../package.json', () => ({
  name: '@nuxt/cli-edge'
}))

describe('run in edge', () => {
  test('throws error if nuxt and nuxt-edge are installed', async () => {
    await expect(run())
      .rejects.toThrow('Both `nuxt` and `nuxt-edge` dependencies are installed! This is unsupported, please choose one and remove the other one from dependencies.')
  })
})
