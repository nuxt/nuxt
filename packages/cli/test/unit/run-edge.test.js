import run from '../../src/run'

jest.mock('../../package.json', () => ({
  name: 'cli-edge'
}))

describe('run in edge', () => {
  test('throws error if nuxt and nuxt-edge are installed', async () => {
    await expect(run())
      .rejects.toThrow('nuxt and nuxt-edge are installed at same time, please remove the unused one')
  })
})
