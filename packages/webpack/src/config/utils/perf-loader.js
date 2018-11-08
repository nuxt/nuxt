import path from 'path'

import { warmup } from 'thread-loader'

// https://github.com/webpack-contrib/thread-loader
// https://github.com/webpack-contrib/cache-loader

export default class PerfLoader {
  constructor(config) {
    this.name = config.name
    this.options = config.options
    this.workerPools = PerfLoader.defaultPools(this.options)
    return new Proxy(this, {
      get(target, name) {
        return target[name] ? target[name] : target.use.bind(target, name)
      }
    })
  }

  static defaultPools({ dev }) {
    const poolTimeout = dev ? Infinity : 2000
    return {
      js: { name: 'js', poolTimeout },
      css: { name: 'css', poolTimeout }
    }
  }

  static warmupAll(options) {
    options = PerfLoader.defaultPools(options)
    PerfLoader.warmup(options.js, [
      require.resolve('babel-loader'),
      require.resolve('@babel/preset-env')
    ])
    PerfLoader.warmup(options.css, ['css-loader'])
  }

  use(poolName) {
    const loaders = []

    if (this.options.build.cache) {
      loaders.push({
        loader: 'cache-loader',
        options: {
          cacheDirectory: path.resolve(`node_modules/.cache/cache-loader/${this.name}`)
        }
      })
    }

    if (this.options.build.parallel) {
      const pool = this.workerPools[poolName]
      if (pool) {
        loaders.push({
          loader: 'thread-loader',
          options: pool
        })
      }
    }

    return loaders
  }
}

PerfLoader.warmup = warmup
