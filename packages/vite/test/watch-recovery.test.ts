import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { FSWatcher } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mtimes = new Map<string, number>()

vi.mock('node:fs/promises', () => ({
  stat: vi.fn((path: string) => {
    const mtimeMs = mtimes.get(path)
    return mtimeMs === undefined
      ? Promise.reject(Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' }))
      : Promise.resolve({ mtimeMs })
  }),
}))

const { recoverThrottledChanges } = await import('../src/utils/watch-recovery')

const RECHECK_DELAY = 70

const dir = join('/project', 'app')
const file = join(dir, 'index.vue')

function createWatcher () {
  const watcher = new EventEmitter() as unknown as FSWatcher
  const changes: Array<[string, unknown]> = []
  recoverThrottledChanges(watcher)
  watcher.on('change', (path, stats) => changes.push([path, stats]))
  return { watcher, changes }
}

beforeEach(() => {
  vi.useFakeTimers()
  mtimes.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('recoverThrottledChanges', () => {
  it('re-emits a change chokidar throttled away', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })

    expect(changes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toEqual([[file, { mtimeMs: 2000 }]])
  })

  it('forwards the recovered change to `all` listeners', async () => {
    const { watcher } = createWatcher()
    const all: unknown[][] = []
    watcher.on('all', (...args) => all.push(args))

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(all).toEqual([['change', file, { mtimeMs: 2000 }]])
  })

  it('does not emit when the file is unmodified', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 1000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(0)
  })

  it('does not emit for files chokidar has never reported', async () => {
    const { watcher, changes } = createWatcher()

    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(0)
  })

  it.each(['add', 'unlink', 'ready'])('ignores raw `%s` events', async (event) => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', event, 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(0)
  })

  it.each(['change', 'rename', 'modified'])('recovers from raw `%s` events', async (event) => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', event, 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(1)
  })

  it('emits once for a burst of raw events', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    for (let i = 0; i < 5; i++) {
      watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    }
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toEqual([[file, { mtimeMs: 2000 }]])
  })

  it('tracks the recovered mtime so a later change is still detected', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)
    expect(changes).toHaveLength(1)

    mtimes.set(file, 3000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)
    expect(changes).toHaveLength(2)
  })

  it('stops tracking and cancels pending rechecks on unlink', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    watcher.emit('unlink', file)
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(0)
  })

  it('swallows stat failures for a file removed mid-recheck', async () => {
    const { watcher, changes } = createWatcher()

    watcher.emit('add', file, { mtimeMs: 1000 })
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toHaveLength(0)
  })

  it('picks up mtimes for events chokidar reports without stats', async () => {
    const { watcher, changes } = createWatcher()

    mtimes.set(file, 1000)
    watcher.emit('change', file)
    await vi.advanceTimersByTimeAsync(0)
    changes.length = 0

    mtimes.set(file, 2000)
    watcher.emit('raw', 'change', 'index.vue', { watchedPath: dir })
    await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

    expect(changes).toEqual([[file, { mtimeMs: 2000 }]])
  })

  describe('path resolution', () => {
    it('resolves a watched file reported by basename', async () => {
      const { watcher, changes } = createWatcher()

      watcher.emit('add', file, { mtimeMs: 1000 })
      mtimes.set(file, 2000)
      watcher.emit('raw', 'change', 'index.vue', { watchedPath: file })
      await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

      expect(changes).toEqual([[file, { mtimeMs: 2000 }]])
    })

    it('prefers the child when a directory holds a same-named entry', async () => {
      const { watcher, changes } = createWatcher()
      const nested = join(dir, 'app')

      watcher.emit('add', nested, { mtimeMs: 1000 })
      watcher.emit('add', dir, { mtimeMs: 1000 })
      mtimes.set(nested, 2000)
      mtimes.set(dir, 2000)
      watcher.emit('raw', 'change', 'app', { watchedPath: dir })
      await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

      expect(changes).toEqual([[nested, { mtimeMs: 2000 }]])
    })

    it('resolves absolute paths reported without a watched path', async () => {
      const { watcher, changes } = createWatcher()

      watcher.emit('add', file, { mtimeMs: 1000 })
      mtimes.set(file, 2000)
      watcher.emit('raw', 'modified', file, { flags: 1 })
      await vi.advanceTimersByTimeAsync(RECHECK_DELAY)

      expect(changes).toEqual([[file, { mtimeMs: 2000 }]])
    })
  })
})
