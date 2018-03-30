
import path from 'path'
import PerfLoader from '../../lib/builder/webpack/utils/perf-loader'

describe('webpack configuration', () => {
  test('performance loader', () => {
    const perfLoader = new PerfLoader({
      dev: true,
      build: {
        parallel: true,
        cache: true
      }
    })
    const js = { name: 'js', poolTimeout: Infinity }
    const css = { name: 'css', poolTimeout: Infinity }
    expect(perfLoader.workerPools).toMatchObject({ js, css })

    const warmup = jest.fn()
    perfLoader.threadLoader = { warmup }
    perfLoader.warmup()
    expect(warmup).toHaveBeenCalledTimes(2)
    expect(warmup).toHaveBeenCalledWith(js, ['babel-loader', 'babel-preset-env'])
    expect(warmup).toHaveBeenCalledWith(css, ['css-loader'])

    const loaders = perfLoader.pool('js', { loader: 'test-perf-loader' })
    const cacheDirectory = path.resolve('node_modules/.cache/cache-loader')
    expect(loaders).toMatchObject([
      { loader: 'cache-loader', options: { cacheDirectory } },
      { loader: 'thread-loader', options: js },
      { loader: 'test-perf-loader' }
    ])
  })
})
