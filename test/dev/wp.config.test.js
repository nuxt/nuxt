
import path from 'path'
import PerfLoader from '../../packages/webpack/src/utils/perf-loader'

describe('webpack configuration', () => {
  test('performance loader', () => {
    const js = { name: 'js', poolTimeout: Infinity }
    const css = { name: 'css', poolTimeout: Infinity }
    const resolveModule = jest.fn(id => id)
    PerfLoader.warmup = jest.fn()
    PerfLoader.warmupAll({ dev: true, resolveModule })
    expect(PerfLoader.warmup).toHaveBeenCalledTimes(2)
    expect(PerfLoader.warmup).toHaveBeenCalledWith(js, [
      'babel-loader',
      '@babel/preset-env'
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
          prodParallelRunner: false, // must have no effect with `dev` option
          cache: true
        }
      },
      {
        resolveModule
      }
    )
    expect(perfLoader.workerPools).toMatchObject({ js, css })
    const loaders = perfLoader.use('js')
    const cacheDirectory = path.resolve('node_modules/.cache/cache-loader/test-perf')
    expect(loaders).toMatchObject([
      { loader: 'cache-loader', options: { cacheDirectory } },
      { loader: 'thread-loader', options: js }
    ])
  })
})
