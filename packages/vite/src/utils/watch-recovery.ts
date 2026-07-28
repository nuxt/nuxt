import { stat } from 'node:fs/promises'
import { join } from 'pathe'
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

    // `path` is relative to the watched directory when a directory is watched,
    // and equal to the watched path when the file itself is watched.
    const watched = typeof details?.watchedPath === 'string' ? details.watchedPath : undefined
    const file = !watched || watched.endsWith(path) ? watched || path : join(watched, path)

    // Only files chokidar has already reported are candidates: the throttle can
    // only drop an event that had a predecessor, and this keeps us from
    // inventing events for ignored paths.
    if (!knownMtimes.has(file) || pending.has(file)) { return }

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
