import path from 'path'

import { warmup } from 'thread-loader'

// https://github.com/webpack-contrib/thread-loader
// https://github.com/webpack-contrib/cache-loader

export default class PerfLoader {
  constructor (name, buildContext, { resolveModule }) {
    this.name = name
    this.buildContext = buildContext
    this.workerPools = PerfLoader.defaultPools({ dev: buildContext.options.dev })
    this.resolveModule = resolveModule
    return new Proxy(this, {
      get (target, name) {
        return target[name] ? target[name] : target.use.bind(target, name)
      }
    })
  }

  static defaultPools ({ dev }) {
    const poolTimeout = dev ? Infinity : 2000
    return {
      js: { name: 'js', poolTimeout },
      css: { name: 'css', poolTimeout }
    }
  }

  static warmupAll ({ dev, resolveModule }) {
    const pools = PerfLoader.defaultPools({ dev })
    PerfLoader.warmup(pools.js, [
      resolveModule('babel-loader'),
      resolveModule('@babel/preset-env')
    ])
    PerfLoader.warmup(pools.css, [resolveModule('css-loader')])
  }

  static warmup (...args) {
    warmup(...args)
  }

  use (poolName) {
    const loaders = []

    if (this.buildContext.buildOptions.cache) {
      loaders.push({
        loader: this.resolveModule('cache-loader'),
        options: {
          cacheDirectory: path.resolve(`node_modules/.cache/cache-loader/${this.name}`)
        }
      })
    }

    if (this.buildContext.buildOptions.parallel) {
      const pool = this.workerPools[poolName]
      if (pool) {
        loaders.push({
          loader: this.resolveModule('thread-loader'),
          options: pool
        })
      }
    }

    return loaders
  }
}
