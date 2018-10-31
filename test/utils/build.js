import { loadFixture, Nuxt, Builder, BundleBuilder, listPaths, equalOrStartsWith } from './index'

export const buildFixture = function (fixture, callback, hooks = []) {
  const pathsBefore = {}
  let nuxt

  test(`Build ${fixture}`, async () => {
    const config = await loadFixture(fixture)
    nuxt = new Nuxt(config)

    pathsBefore.root = listPaths(nuxt.options.rootDir)
    if (nuxt.options.rootDir !== nuxt.options.srcDir) {
      pathsBefore.src = listPaths(nuxt.options.srcDir)
    }

    const buildDone = jest.fn()
    hooks.forEach(([hook, fn]) => nuxt.hook(hook, fn))
    nuxt.hook('build:done', buildDone)
    const builder = await new Builder(nuxt, BundleBuilder).build()
    // 2: BUILD_DONE
    expect(builder._buildStatus).toBe(2)
    expect(buildDone).toHaveBeenCalledTimes(1)
    if (typeof callback === 'function') {
      callback(builder)
    }
  }, 120000)

  test('Check changed files', () => {
    expect.hasAssertions()

    // When building Nuxt we only expect files to changed
    // within the nuxt.options.buildDir
    Object.keys(pathsBefore).forEach((key) => {
      const paths = listPaths(nuxt.options[`${key}Dir`], pathsBefore[key])
      paths.forEach((item) => {
        expect(equalOrStartsWith(nuxt.options.buildDir, item.path)).toBe(true)
      })
    })
  })
}
