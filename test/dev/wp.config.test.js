
import path from 'path'
import createRequire from 'create-require'
import PerfLoader from '../../packages/webpack/src/utils/perf-loader'

const webpackRequire = createRequire(path.resolve(__dirname, '../../packages/webpack'))

describe('webpack configuration', () => {
  test('performance loader', () => {
    const js = { name: 'js', poolTimeout: Infinity }
    const css = { name: 'css', poolTimeout: Infinity }
    PerfLoader.warmup = jest.fn()
    PerfLoader.warmupAll({ dev: true })
    expect(PerfLoader.warmup).toHaveBeenCalledTimes(2)
    expect(PerfLoader.warmup).toHaveBeenCalledWith(js, [
      webpackRequire.resolve('babel-loader'),
      webpackRequire.resolve('@babel/preset-env')
    ])
    expect(PerfLoader.warmup).toHaveBeenCalledWith(css, [webpackRequire.resolve('css-loader')])

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
    const cacheDirectory = path.resolve('node_modules/.cache/cache-loader/test-perf')
    expect(loaders).toMatchObject([
      { loader: 'cache-loader', options: { cacheDirectory } },
      { loader: 'thread-loader', options: js }
    ])
  })
})
