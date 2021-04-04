import chokidar, { WatchOptions } from 'chokidar'
import defu from 'defu'
import consola from 'consola'

import Ignore from './utils/ignore'

export type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

export type WatchCallback = (event: WatchEvent, path: string) => void
export type WatchFilter = (event: WatchEvent, path: string) => boolean | null

export function createWatcher (
  pattern: string,
  options?: WatchOptions,
  ignore?: Ignore
) {
  const opts = defu(options!, {
    ignored: [],
    ignoreInitial: true
  })
  const watcher = chokidar.watch(pattern, opts)
  const watchAll = (cb: WatchCallback, filter?: WatchFilter) => {
    watcher.on('all', (event, path: string) => {
      if (ignore && ignore.ignores(path)) {
        return
      }
      if (!filter || filter(event, path)) {
        cb(event, path)
      }
    })
  }

  const watch = (pattern: string | RegExp, cb: WatchCallback, events?: WatchEvent[]) =>
    watchAll(cb, (event, path) => path.match(pattern) && (!events || events.includes(event)))

  const debug = (tag: string = '[Watcher]') => {
    consola.log(tag, 'Watching ', pattern)
    watchAll((event, path) => {
      consola.log(tag, event, path)
    })
  }

  return {
    watchAll,
    watch,
    debug,
    close: () => watcher.close()
  }
}

export type Watcher = ReturnType<typeof createWatcher>
