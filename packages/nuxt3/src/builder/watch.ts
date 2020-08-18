import chokidar, { WatchOptions } from 'chokidar'
import defu from 'defu'
import consola from 'consola'
import Ignore from './ignore'

export function createWatcher (
  dir: string,
  options?: WatchOptions,
  ignore?: Ignore
) {
  const opts = defu({ cwd: dir }, options, {
    ignored: [],
    ignoreInitial: true
  })
  const watcher = chokidar.watch(dir, opts)
  const watchAll = (cb: Function, filter?: Function) => {
    watcher.on('all', (event, path: string) => {
      if (ignore && ignore.ignores(path)) {
        return
      }
      const _event = { event, path }
      if (!filter || filter(_event)) {
        cb(_event)
      }
    })
  }

  const watch = (pattern: string | RegExp, cb: Function) =>
    watchAll(cb, e => e.path.match(pattern))

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
