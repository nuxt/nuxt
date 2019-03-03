
import PerfLoader from '../../packages/webpack/src/utils/perf-loader'

describe('webpack configuration', () => {
  test('performance loader', () => {
    const js = { name: 'js', poolTimeout: Infinity }
    const css = { name: 'css', poolTimeout: Infinity }
    PerfLoader.warmup = jest.fn()
    PerfLoader.warmupAll({ dev: true })
    expect(PerfLoader.warmup).toHaveBeenCalledTimes(2)
    expect(PerfLoader.warmup).toHaveBeenCalledWith(js, [
      require.resolve('babel-loader'),
      require.resolve('@babel/preset-env')
    ])
    expect(PerfLoader.warmup).toHaveBeenCalledWith(css, ['css-loader'])

    const perfLoader = new PerfLoader(
      'test-perf',
      {
        options: {
          dev: true
        },
        buildOptions: {
          parallel: true,
          cache: true
        }
      }
    )
    expect(perfLoader.workerPools).toMatchObject({ js, css })
    const loaders = perfLoader.use('js')
    expect(loaders).toMatchObject([
      { loader: 'thread-loader', options: js }
    ])
  })
})
