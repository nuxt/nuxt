import WebpackBaseConfig from '../../packages/webpack/src/config/base'

const createWebpackBaseConfig = (typescriptBuild, ignoreNotFoundWarnings) => {
  const builder = {
    buildContext: {
      buildOptions: {
        typescript: { ignoreNotFoundWarnings },
        transpile: [],
        warningFixFilters: require('../../packages/config/src/config/build')().warningFixFilters
      },
      options: {
        _typescript: { build: typescriptBuild }
      }
    }
  }

  return new WebpackBaseConfig(builder)
}

describe('warningFixFilter', () => {
  let filters
  const name = 'ModuleDependencyWarning'

  describe('disabled ignoreNotFoundWarnings', () => {
    beforeEach(() => {
      filters = createWebpackBaseConfig(true, false).warningFixFilter()
    })

    test('should be true', () => expect(filters({})).toBe(true))
    test('should be true', () => expect(filters({ name, message: 'error!' })).toBe(true))
    test('should be false', () => expect(filters({ name, message: `export 'default' nuxt_plugin_xxxx` })).toBe(false))
    test('should be true', () => expect(filters({ name, message: `export 'xxx' was not found in ` })).toBe(true))
  })

  describe('enabled ignoreNotFoundWarnings', () => {
    beforeEach(() => {
      filters = createWebpackBaseConfig(true, true).warningFixFilter()
    })

    test('should be true', () => expect(filters({})).toBe(true))
    test('should be true', () => expect(filters({ name, message: 'error!' })).toBe(true))
    test('should be false', () => expect(filters({ name, message: `export 'default' nuxt_plugin_xxxx` })).toBe(false))
    test('should be false', () => expect(filters({ name, message: `export 'xxx' was not found in ` })).toBe(false))
  })
})
