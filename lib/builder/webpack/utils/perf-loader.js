import path from 'path'

import threadLoader from 'thread-loader'

// https://github.com/webpack-contrib/thread-loader
// https://github.com/webpack-contrib/cache-loader

export default class PerfLoader {
  constructor(builder) {
    this.builder = builder
    this.options = builder.options

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

  warmup() {
    threadLoader.warmup(this.workerPools.js, ['babel-loader', 'babel-preset-env'])
    threadLoader.warmup(this.workerPools.css, ['css-loader'])
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
