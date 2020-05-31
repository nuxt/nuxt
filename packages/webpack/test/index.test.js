import WebpackBaseConfig from '../src/config/base'

describe('webpack: babel', () => {
  const getConfigWithPlugins = plugins =>
    new WebpackBaseConfig({
      buildContext: {
        options: {
          dev: false
        },
        buildOptions: {
          babel: {
            plugins
          }
        }
      }
    })
  test('should allow defining plugins with an array', () => {
    expect(getConfigWithPlugins(['myPlugin']).getBabelOptions().plugins).toEqual(['myPlugin'])
  })
  test('should allow defining plugins with a function', () => {
    expect(getConfigWithPlugins(({ isDev }) => [`myPlugin-${isDev}`]).getBabelOptions().plugins).toEqual(['myPlugin-false'])
  })
})
