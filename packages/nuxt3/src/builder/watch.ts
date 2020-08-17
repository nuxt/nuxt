import { relative } from 'path'
import chokidar, { WatchOptions } from 'chokidar'
import consola from 'consola'

export function createWatcher (dir: string, options?: WatchOptions) {
  const watcher = chokidar.watch(dir, {
    ignored: [],
    ignoreInitial: true,
    ...options
  })

  const watchAll = (cb: Function, filter?: Function) => {
    watcher.on('raw', (event, path: string, _details) => {
      if (options.ignored.find(ignore => path.match(ignore))) {
        return // 🖕 chokidar ignored option
      }
      path = relative(dir, path)
      const _event = { event, path }
      if (!filter || filter(_event)) {
        cb(_event)
      }
    })
  }

  const watch = (pattern: string| RegExp, cb: Function) => watchAll(cb, e => e.path.match(pattern))

  const debug = (tag: string = '[Watcher]') => {
    consola.log(tag, 'Watching ', dir)
    watchAll((e) => {
      consola.log(tag, e.event, e.path)
    })
  }

  return {
    watchAll,
    watch,
    debug
  }
}

export type Watcher = ReturnType<typeof createWatcher>
