/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Base: https://github.com/webpack/webpack/blob/v4.46.0/lib/node/NodeWatchFileSystem.js (Tobias Koppers @sokra)
*/
import Watchpack from 'watchpack'
import objectToMap from 'webpack/lib/util/objectToMap'

export class Watchpack2Plugin {
  apply (compiler) {
    if (compiler.watchFileSystem && compiler.watchFileSystem.watcher) {
      compiler.watchFileSystem.watcher.close()
    }
    compiler.watchFileSystem = new NodeWatchFileSystem(
      compiler.inputFileSystem
    )
  }
}

export class NodeWatchFileSystem {
  constructor (inputFileSystem) {
    this.inputFileSystem = inputFileSystem
    this.watcherOptions = {
      aggregateTimeout: 0
    }
    this.watcher = new Watchpack(this.watcherOptions)
  }

  watch (files, dirs, missing, startTime, options, callback, callbackUndelayed) {
    if (!Array.isArray(files)) {
      throw new TypeError("Invalid arguments: 'files'")
    }
    if (!Array.isArray(dirs)) {
      throw new TypeError("Invalid arguments: 'dirs'")
    }
    if (!Array.isArray(missing)) {
      throw new TypeError("Invalid arguments: 'missing'")
    }
    if (typeof callback !== 'function') {
      throw new TypeError("Invalid arguments: 'callback'")
    }
    if (typeof startTime !== 'number' && startTime) {
      throw new Error("Invalid arguments: 'startTime'")
    }
    if (typeof options !== 'object') {
      throw new TypeError("Invalid arguments: 'options'")
    }
    if (typeof callbackUndelayed !== 'function' && callbackUndelayed) {
      throw new Error("Invalid arguments: 'callbackUndelayed'")
    }
    const oldWatcher = this.watcher
    this.watcher = new Watchpack(options)

    if (callbackUndelayed) {
      this.watcher.once('change', callbackUndelayed)
    }
    const cachedFiles = files
    const cachedDirs = dirs
    this.watcher.once('aggregated', (_changes, _removals) => {
      const removals = Array.from(_removals)
      const changes = Array.from(_changes).concat(removals)
      if (this.inputFileSystem && this.inputFileSystem.purge) {
        this.inputFileSystem.purge(changes)
      }
      const times = objectToMap(this.watcher.getTimes())
      files = new Set(files)
      dirs = new Set(dirs)
      missing = new Set(missing)
      callback(
        null,
        changes.filter(file => files.has(file)).sort(),
        changes.filter(file => dirs.has(file)).sort(),
        changes.filter(file => missing.has(file)).sort(),
        times,
        times,
        new Set(removals.filter(file => files.has(file)))
      )
    })

    this.watcher.watch(
      cachedFiles.concat(missing),
      cachedDirs.concat(missing),
      startTime
    )

    if (oldWatcher) {
      oldWatcher.close()
    }
    return {
      close: () => {
        if (this.watcher) {
          this.watcher.close()
          this.watcher = null
        }
      },
      pause: () => {
        if (this.watcher) {
          this.watcher.pause()
        }
      },
      getFileTimestamps: () => {
        if (this.watcher) {
          return objectToMap(this.watcher.getTimes())
        } else {
          return new Map()
        }
      },
      getContextTimestamps: () => {
        if (this.watcher) {
          return objectToMap(this.watcher.getTimes())
        } else {
          return new Map()
        }
      }
    }
  }
}
