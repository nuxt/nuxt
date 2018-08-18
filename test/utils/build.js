import { loadFixture, Nuxt, Builder } from './index'

export const buildFixture = function (fixture, callback) {
  test(`Build ${fixture}`, async () => {
    const config = await loadFixture(fixture)
    const nuxt = new Nuxt(config)
    const buildDone = jest.fn()
    nuxt.hook('build:done', buildDone)
    const builder = await new Builder(nuxt).build()
    // 2: BUILD_DONE
    expect(builder._buildStatus).toBe(2)
    expect(buildDone).toHaveBeenCalledTimes(1)
    if (typeof callback === 'function') {
      callback(builder)
    }
  }, 120000)
}
