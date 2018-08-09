import path from 'path'

import { warmup } from 'thread-loader'

// https://github.com/webpack-contrib/thread-loader
// https://github.com/webpack-contrib/cache-loader

export default class PerfLoader {
  constructor(options) {
    this.options = options
    this.warmup = warmup
    this.workerPools = {
      js: {
        name: 'js',
        poolTimeout: this.options.dev ? Infinity : 2000
      },
      css: {
        name: 'css',
        poolTimeout: this.options.dev ? Infinity : 2000
      }
    }
  }

  warmupAll() {
    this.warmup(this.workerPools.js, ['babel-loader', '@babel/preset-env'])
    this.warmup(this.workerPools.css, ['css-loader'])
  }

  pool(poolName, _loaders) {
    const loaders = [].concat(_loaders)

    if (this.options.build.parallel) {
      const pool = this.workerPools[poolName]

      if (pool) {
        loaders.unshift({
          loader: 'thread-loader',
          options: pool
        })
      }
    }

    if (this.options.build.cache) {
      loaders.unshift({
        loader: 'cache-loader',
        options: {
          cacheDirectory: path.resolve('node_modules/.cache/cache-loader')
        }
      })
    }

    return loaders
  }

  poolOneOf(poolName, oneOfRules) {
    return oneOfRules.map(rule => Object.assign({}, rule, {
      use: this.pool(poolName, rule.use)
    }))
  }
}
