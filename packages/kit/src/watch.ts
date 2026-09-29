import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const RECHECK_DELAY = 70

/**
 * A single write moves the mtime more than once (truncate, then write) and
 * chokidar may dispatch `change` off the first of those, so a mtime a hair
 * newer than the one recorded is the tail of a write that *was* reported
 * rather than one that was dropped.
 */
const MTIME_EPSILON = 10
const RECOVERY_FLAG = Symbol.for('nuxt:watch-recovery')

/**
 * The subset of a chokidar `FSWatcher` this helper needs. Callers hold
 * different chokidar majors (Nuxt core watches with v5, Vite bundles v3), so
 * the parameter is structural rather than an import of either package.
 */
export interface RecoverableWatcher {
  on: (event: any, listener: (...args: any[]) => void) => any
  emit: (event: any, ...args: any[]) => any
  options?: { cwd?: string | undefined } | undefined
}

interface TrackedFile {
  mtimeMs: number
  /** the path in the namespace chokidar emits, which is relative when `cwd` is set */
  path: string
}

/**
 * chokidar suppresses a `change` event that lands within 50ms of the previous
 * `change` for the same path, and never replays it. A save that follows a fast
 * HMR round trip is therefore silently lost until the file is touched again,
 * which looks exactly like broken HMR. This is true of every chokidar major
 * Nuxt uses.
 *
 * Raw fs events are not throttled, so once chokidar has reported a file at
 * least once we can use them to notice a modification that never surfaced as a
 * `change` event, and re-emit it after the throttle window has passed.
 *
 * @param watcher the chokidar watcher to patch
 * @returns a disposer releasing the recovery state; call it when the watcher closes
 */
export function recoverThrottledChanges (watcher: RecoverableWatcher): () => void {
  const patched = (watcher as unknown as Record<symbol, boolean>)[RECOVERY_FLAG]
  if (patched) { return () => {} }
  Object.defineProperty(watcher, RECOVERY_FLAG, { value: true, configurable: true })

  const tracked = new Map<string, TrackedFile>()
  const pending = new Map<string, NodeJS.Timeout>()
  let disposed = false

  /**
   * With `cwd` set, chokidar emits high-level events relative to it while raw
   * events carry an absolute `watchedPath`, so everything is keyed absolutely
   * and the emitted path is kept alongside to re-emit in chokidar's namespace.
   */
  const cwd = watcher.options?.cwd
  const toKey = (path: string) => cwd ? resolve(cwd, path) : path

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
      const key = toKey(path)
      return tracked.has(key) ? key : undefined
    }

    const child = toKey(join(watched, path))
    if (tracked.has(child)) { return child }

    const parent = toKey(watched)
    return tracked.has(parent) ? parent : undefined
  }

  const track = (path: string, stats?: { mtimeMs: number }) => {
    if (disposed) { return }
    const key = toKey(path)
    if (stats) {
      tracked.set(key, { mtimeMs: stats.mtimeMs, path })
      return
    }
    void stat(key).then((s) => {
      if (!disposed) { tracked.set(key, { mtimeMs: s.mtimeMs, path }) }
    }, () => {})
  }

  const forget = (path: string) => {
    const key = toKey(path)
    tracked.delete(key)
    const timeout = pending.get(key)
    if (timeout) {
      clearTimeout(timeout)
      pending.delete(key)
    }
  }

  watcher.on('add', track)
  watcher.on('change', track)
  watcher.on('unlink', forget)

  watcher.on('raw', (event: string, path: string, details: unknown) => {
    if (disposed) { return }
    if (event !== 'change' && event !== 'rename' && event !== 'modified') { return }

    // `fs.watch` does not always report a filename
    if (typeof path !== 'string' || !path) { return }

    // Only files chokidar has already reported are candidates: the throttle can
    // only drop an event that had a predecessor, and this keeps us from
    // inventing events for ignored paths.
    const file = resolveTracked(path, details)
    if (!file || pending.has(file)) { return }

    const timeout = setTimeout(() => {
      pending.delete(file)
      if (disposed) { return }
      void stat(file).then((stats) => {
        if (disposed) { return }
        const previous = tracked.get(file)
        if (!previous) { return }
        tracked.set(file, { mtimeMs: stats.mtimeMs, path: previous.path })
        if (stats.mtimeMs - previous.mtimeMs <= MTIME_EPSILON) { return }
        watcher.emit('change', previous.path, stats)
        watcher.emit('all', 'change', previous.path, stats)
      }, () => {})
    }, RECHECK_DELAY)
    timeout.unref()
    pending.set(file, timeout)
  })

  return () => {
    disposed = true
    for (const timeout of pending.values()) {
      clearTimeout(timeout)
    }
    pending.clear()
    tracked.clear()
  }
}
