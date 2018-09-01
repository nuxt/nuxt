
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

    perfLoader.warmup = jest.fn()
    perfLoader.warmupAll()
    expect(perfLoader.warmup).toHaveBeenCalledTimes(2)
    expect(perfLoader.warmup).toHaveBeenCalledWith(js, ['babel-loader', '@babel/preset-env'])
    expect(perfLoader.warmup).toHaveBeenCalledWith(css, ['css-loader'])

    const loaders = perfLoader.pool('js', { loader: 'test-perf-loader' })
    const cacheDirectory = path.resolve('node_modules/.cache/cache-loader')
    expect(loaders).toMatchObject([
      { loader: 'cache-loader', options: { cacheDirectory } },
      { loader: 'thread-loader', options: js },
      { loader: 'test-perf-loader' }
    ])
  })
})
