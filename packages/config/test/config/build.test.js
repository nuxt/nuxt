import buildConfig from '../../src/config/build'

describe('config: build', () => {
  test('should return dev filenames', () => {
    const { filenames } = buildConfig()
    const env = { isDev: true }
    expect(filenames.app(env)).toEqual('[name].js')
    expect(filenames.chunk(env)).toEqual('[name].js')
    expect(filenames.css(env)).toEqual('[name].css')
    expect(filenames.img(env)).toEqual('[path][name].[ext]')
    expect(filenames.font(env)).toEqual('[path][name].[ext]')
    expect(filenames.video(env)).toEqual('[path][name].[ext]')
  })

  test('should return prod filenames', () => {
    const { filenames } = buildConfig()
    const env = { isDev: false }
    expect(filenames.app(env)).toEqual('[name].js?[contenthash:7]')
    expect(filenames.chunk(env)).toEqual('[name].js?[contenthash:7]')
    expect(filenames.css(env)).toEqual('css/[name].css?[contenthash:7]')
    expect(filenames.img(env)).toEqual('img/[name].[ext]?[contenthash:7]')
    expect(filenames.font(env)).toEqual('fonts/[name].[ext]?[contenthash:7]')
    expect(filenames.video(env)).toEqual('videos/[name].[ext]?[contenthash:7]')
  })

  test('should return modern filenames', () => {
    const { filenames } = buildConfig()
    const env = { isDev: true, isModern: true }
    expect(filenames.app(env)).toEqual('[name].modern.js?[contenthash:7]')
    expect(filenames.chunk(env)).toEqual('[name].modern.js?[contenthash:7]')
  })
})
