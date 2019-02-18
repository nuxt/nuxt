import path from 'path'

import { warmup } from 'thread-loader'

// https://github.com/webpack-contrib/thread-loader
// https://github.com/webpack-contrib/cache-loader

export default class PerfLoader {
  constructor(config) {
    this.config = config
    this.workerPools = PerfLoader.defaultPools({ dev: config.dev })
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

  static warmupAll({ dev }) {
    const pools = PerfLoader.defaultPools({ dev })
    PerfLoader.warmup(pools.js, [
      require.resolve('babel-loader'),
      require.resolve('@babel/preset-env')
    ])
    PerfLoader.warmup(pools.css, ['css-loader'])
  }

  static warmup(...args) {
    warmup(...args)
  }

  use(poolName) {
    const loaders = []

    if (this.config.buildOpts.cache) {
      loaders.push({
        loader: 'cache-loader',
        options: {
          cacheDirectory: path.resolve(`node_modules/.cache/cache-loader/${this.config.name}`)
        }
      })
    }

    if (this.config.buildOpts.parallel) {
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
