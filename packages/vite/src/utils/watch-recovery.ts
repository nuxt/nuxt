import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FSWatcher } from 'vite'

/**
 * chokidar v3 (the version vite bundles) suppresses a `change` event that lands
 * within 50ms of the previous `change` for the same path, and never replays it.
 * A save that follows a fast HMR round trip is therefore silently lost until
 * the file is touched again, which looks exactly like broken HMR.
 *
 * Raw fs events are not throttled, so once chokidar has reported a file at
 * least once we can use them to notice a modification that never surfaced as a
 * `change` event, and re-emit it after the throttle window has passed.
 */
const RECHECK_DELAY = 70

export function recoverThrottledChanges (watcher: FSWatcher): void {
  const knownMtimes = new Map<string, number>()
  const pending = new Map<string, NodeJS.Timeout>()

  /**
   * `watchedPath` is the (possibly relative) path chokidar handed to `fs.watch`
   * and `path` is the name `fs.watch` reported, which is a basename both when
   * the file itself is watched and when its parent directory is. The two are
   * indistinguishable for a directory containing a child of the same name, so
   * pick whichever candidate chokidar has already reported a modification time
   * for, and use native separators to match the paths chokidar emits.
   */
  const resolveTracked = (path: string, details: unknown): string | undefined => {
    const watched = typeof (details as { watchedPath?: unknown } | undefined)?.watchedPath === 'string'
      ? (details as { watchedPath: string }).watchedPath
      : undefined

    if (!watched) {
      return knownMtimes.has(path) ? path : undefined
    }

    const child = join(watched, path)
    if (knownMtimes.has(child)) { return child }

    return knownMtimes.has(watched) ? watched : undefined
  }

  const track = (path: string, stats?: { mtimeMs: number }) => {
    if (stats) {
      knownMtimes.set(path, stats.mtimeMs)
      return
    }
    void stat(path).then(s => knownMtimes.set(path, s.mtimeMs), () => {})
  }

  watcher.on('add', track)
  watcher.on('change', track)
  watcher.on('unlink', (path) => {
    knownMtimes.delete(path)
    const timeout = pending.get(path)
    if (timeout) {
      clearTimeout(timeout)
      pending.delete(path)
    }
  })

  watcher.on('raw', (event, path, details) => {
    if (event !== 'change' && event !== 'rename' && event !== 'modified') { return }

    // Only files chokidar has already reported are candidates: the throttle can
    // only drop an event that had a predecessor, and this keeps us from
    // inventing events for ignored paths.
    const file = resolveTracked(path, details)
    if (!file || pending.has(file)) { return }

    const timeout = setTimeout(() => {
      pending.delete(file)
      void stat(file).then((stats) => {
        if (knownMtimes.get(file) === stats.mtimeMs) { return }
        knownMtimes.set(file, stats.mtimeMs)
        watcher.emit('change', file, stats)
        watcher.emit('all', 'change', file, stats)
      }, () => {})
    }, RECHECK_DELAY)
    timeout.unref()
    pending.set(file, timeout)
  })
}
