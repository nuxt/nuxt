import { describe, expect, it, vi } from 'vitest'
import { createPrefetchScheduler } from '../src/app/internal/prefetch'
import type { PrefetchPriority, PrefetchTask } from '../src/app/internal/prefetch'

function deferred () {
  let resolve!: () => void
  let reject!: (err?: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function tracker () {
  const started: string[] = []
  const dropped: string[] = []
  const controls = new Map<string, ReturnType<typeof deferred>>()
  const run = (key: string) => (signal: AbortSignal) => {
    if (signal.aborted) {
      dropped.push(key)
      return Promise.reject(new Error('dropped'))
    }
    started.push(key)
    const control = deferred()
    controls.set(key, control)
    signal.addEventListener('abort', () => control.reject(new Error('aborted')))
    return control.promise
  }
  return {
    started,
    dropped,
    run,
    finish: (key: string) => {
      controls.get(key)!.resolve()
      return tick()
    },
    fail: (key: string) => {
      controls.get(key)!.reject(new Error('failed'))
      return tick()
    },
  }
}

interface TaskOptions {
  scope?: PrefetchTask['scope']
  group?: string
}

const task = (key: string, priority: PrefetchPriority, run: PrefetchTask['run'], options: TaskOptions = {}): PrefetchTask => ({
  key,
  priority,
  scope: options.scope ?? 'app',
  group: options.group,
  run,
})

describe('prefetch scheduler', () => {
  it('should respect the concurrency budget for a priority', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 2 } })

    for (const key of ['a', 'b', 'c']) {
      scheduler.schedule(task(`hint:${key}`, 'hint', run(key)))
    }
    await tick()

    expect(started).toEqual(['a', 'b'])

    await finish('a')
    expect(started).toEqual(['a', 'b', 'c'])
  })

  it('should drain newest-first within a priority', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

    scheduler.schedule(task('hint:1', 'hint', run('1')))
    scheduler.schedule(task('hint:2', 'hint', run('2')))
    scheduler.schedule(task('hint:3', 'hint', run('3')))
    await tick()
    expect(started).toEqual(['1'])

    await finish('1')
    expect(started).toEqual(['1', '3'])

    await finish('3')
    expect(started).toEqual(['1', '3', '2'])
  })

  it('should drain higher priorities first', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ total: 1 })

    scheduler.schedule(task('hint:a', 'hint', run('hint:a')))
    scheduler.schedule(task('hint:b', 'hint', run('hint:b')))
    scheduler.schedule(task('island:a', 'island', run('island:a')))
    scheduler.schedule(task('payload:a', 'payload', run('payload:a')))
    await tick()
    expect(started).toEqual(['hint:a'])

    await finish('hint:a')
    expect(started).toEqual(['hint:a', 'payload:a'])

    await finish('payload:a')
    expect(started).toEqual(['hint:a', 'payload:a', 'island:a'])

    await finish('island:a')
    expect(started).toEqual(['hint:a', 'payload:a', 'island:a', 'hint:b'])
  })

  it('should cap a single priority below the total budget', async () => {
    const { started, run } = tracker()
    const scheduler = createPrefetchScheduler({ total: 4, concurrency: { hint: 2 } })

    for (const key of ['a', 'b', 'c']) {
      scheduler.schedule(task(`hint:${key}`, 'hint', run(`hint:${key}`)))
    }
    scheduler.schedule(task('payload:a', 'payload', run('payload:a')))
    scheduler.schedule(task('payload:b', 'payload', run('payload:b')))
    await tick()

    expect(started).toEqual(['hint:a', 'hint:b', 'payload:a', 'payload:b'])
  })

  it('should not exceed the budget when starts are deferred', async () => {
    const { started, run, finish } = tracker()
    const deferredStarts: Array<() => void> = []
    const scheduler = createPrefetchScheduler({
      total: 2,
      defer: start => deferredStarts.push(start),
    })

    for (const key of ['a', 'b', 'c', 'd']) {
      scheduler.schedule(task(`hint:${key}`, 'hint', run(key)))
    }
    await tick()

    expect(deferredStarts).toHaveLength(2)
    expect(started).toEqual([])

    deferredStarts.splice(0, 2).forEach(start => start())
    await tick()
    expect(started).toEqual(['a', 'b'])

    await finish('a')
    expect(deferredStarts).toHaveLength(1)
    deferredStarts.splice(0, 1).forEach(start => start())
    await tick()
    expect(started).toEqual(['a', 'b', 'd'])
  })

  it('should tell the deferral hook which starts the user is waiting on', async () => {
    const { started, run, finish } = tracker()
    const promotedStarts: boolean[] = []
    const scheduler = createPrefetchScheduler({
      total: 1,
      defer: (start, promoted) => {
        promotedStarts.push(promoted)
        start()
      },
    })

    scheduler.schedule(task('payload:/a', 'payload', run('a'), { group: '/a' }))
    scheduler.schedule(task('payload:/b', 'payload', run('b'), { group: '/b' }))
    await tick()
    expect(started).toEqual(['a'])

    scheduler.promote('/b')
    await finish('a')

    expect(started).toEqual(['a', 'b'])
    expect(promotedStarts).toEqual([false, true])
  })

  it('should never drop an accepted task', async () => {
    const { started, run, finish, fail } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

    const keys = ['a', 'b', 'c', 'd']
    for (const key of keys) {
      scheduler.schedule(task(`hint:${key}`, 'hint', run(key)))
    }

    for (let i = 0; i < keys.length; i++) {
      await tick()
      const running = started[i]!
      await (i % 2 ? fail(running) : finish(running))
    }

    expect(started.sort()).toEqual(keys)
  })

  it('should deduplicate queued and in-flight tasks by key', async () => {
    const { started, dropped, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

    scheduler.schedule(task('hint:a', 'hint', run('a')))
    scheduler.schedule(task('hint:a', 'hint', run('a-again')))
    scheduler.schedule(task('hint:b', 'hint', run('b')))
    scheduler.schedule(task('hint:b', 'hint', run('b-again')))
    await tick()

    expect(started).toEqual(['a'])
    expect(dropped).toEqual(['a-again', 'b-again'])

    await finish('a')
    expect(started).toEqual(['a', 'b'])

    scheduler.schedule(task('hint:a', 'hint', run('a-third')))
    await finish('b')
    expect(started).toEqual(['a', 'b', 'a-third'])
  })

  it('should promote queued tasks in a group', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

    for (const key of ['a', 'b', 'c', 'd']) {
      scheduler.schedule(task(`hint:${key}`, 'hint', run(key), { group: `/${key}` }))
    }
    await tick()
    expect(started).toEqual(['a'])

    scheduler.promote('/b')
    await finish('a')
    expect(started).toEqual(['a', 'b'])
  })

  it('should promote within each priority, not across them', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ total: 1 })

    scheduler.schedule(task('payload:/blocker', 'payload', run('blocker'), { group: '/blocker' }))
    scheduler.schedule([
      task('hint:wanted-a', 'hint', run('wanted-a'), { group: '/wanted' }),
      task('hint:wanted-b', 'hint', run('wanted-b'), { group: '/wanted' }),
    ])
    scheduler.schedule(task('hint:other', 'hint', run('other'), { group: '/other' }))
    scheduler.schedule(task('payload:/other', 'payload', run('payload:other'), { group: '/other' }))
    scheduler.promote('/wanted')
    await tick()

    for (const key of ['blocker', 'payload:other', 'wanted-a', 'wanted-b']) {
      await finish(key)
    }
    expect(started).toEqual(['blocker', 'payload:other', 'wanted-a', 'wanted-b', 'other'])
  })

  it('should queue a batch ahead of earlier work but keep its own order', async () => {
    const { started, run, finish } = tracker()
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

    scheduler.schedule(task('hint:blocker', 'hint', run('blocker')))
    scheduler.schedule([task('hint:1a', 'hint', run('1a')), task('hint:1b', 'hint', run('1b'))])
    scheduler.schedule([task('hint:2a', 'hint', run('2a')), task('hint:2b', 'hint', run('2b'))])
    await tick()
    expect(started).toEqual(['blocker'])

    for (const key of ['blocker', '2a', '2b', '1a']) {
      await finish(key)
    }
    expect(started).toEqual(['blocker', '2a', '2b', '1a', '1b'])
  })

  it('should abort in-flight navigation tasks and dequeue navigation work on reset', async () => {
    const aborted: string[] = []
    const started: string[] = []
    const dropped: string[] = []
    const scheduler = createPrefetchScheduler({ concurrency: { hint: 1, payload: 1 } })
    const run = (key: string) => (signal: AbortSignal) => {
      if (signal.aborted) {
        dropped.push(key)
        return Promise.reject(new Error('dropped'))
      }
      started.push(key)
      signal.addEventListener('abort', () => aborted.push(key))
      return new Promise(() => {})
    }

    scheduler.schedule(task('hint:nav', 'hint', run('hint:nav'), { scope: 'navigation' }))
    scheduler.schedule(task('payload:app', 'payload', run('payload:app'), { scope: 'app' }))
    scheduler.schedule(task('hint:queued', 'hint', run('hint:queued'), { scope: 'navigation' }))
    await tick()

    expect(started).toEqual(['hint:nav', 'payload:app'])

    scheduler.reset()
    await tick()

    expect(aborted).toEqual(['hint:nav'])
    expect(dropped).toEqual(['hint:queued'])
  })

  it('should retain the destination being navigated to, apart from its hints', async () => {
    const aborted: string[] = []
    const dropped: string[] = []
    const scheduler = createPrefetchScheduler({ concurrency: { payload: 2 } })
    const run = (key: string) => (signal: AbortSignal) => {
      if (signal.aborted) {
        dropped.push(key)
        return Promise.reject(new Error('dropped'))
      }
      signal.addEventListener('abort', () => aborted.push(key))
      return new Promise(() => {})
    }

    scheduler.schedule(task('payload:/wanted', 'payload', run('wanted'), { scope: 'navigation', group: '/wanted' }))
    scheduler.schedule(task('payload:/other', 'payload', run('other'), { scope: 'navigation', group: '/other' }))
    scheduler.schedule(task('hint:/wanted', 'hint', run('hint:wanted'), { scope: 'navigation', group: '/wanted' }))
    scheduler.schedule(task('hint:/other', 'hint', run('hint:other'), { scope: 'navigation', group: '/other' }))
    await tick()

    scheduler.reset('/wanted')
    await tick()

    expect(aborted).toEqual(['other', 'hint:wanted', 'hint:other'])
    expect(dropped).toEqual([])
  })

  it('should let a navigation-scoped task be rescheduled after reset', async () => {
    const started: string[] = []
    const dropped: string[] = []
    const abortedTask = deferred()
    const scheduler = createPrefetchScheduler()
    // the aborted task settles only once the new owner of its key is in flight
    const run = (key: string) => (signal: AbortSignal) => {
      if (signal.aborted) {
        dropped.push(key)
        return Promise.reject(new Error('dropped'))
      }
      started.push(key)
      return key === 'first' ? abortedTask.promise : new Promise(() => {})
    }

    scheduler.schedule(task('payload:/a', 'payload', run('first'), { scope: 'navigation' }))
    await tick()
    scheduler.reset()
    await tick()

    scheduler.schedule(task('payload:/a', 'payload', run('second'), { scope: 'navigation' }))
    await tick()
    expect(started).toEqual(['first', 'second'])

    abortedTask.reject(new Error('aborted'))
    await tick()

    scheduler.schedule(task('payload:/a', 'payload', run('third'), { scope: 'navigation' }))
    await tick()
    expect(started).toEqual(['first', 'second'])
    expect(dropped).toEqual(['third'])
  })

  it('should expose queue state in dev only', async () => {
    expect(createPrefetchScheduler().inspect).toBeUndefined()

    vi.stubGlobal('__TEST_DEV__', true)
    try {
      const { run } = tracker()
      const scheduler = createPrefetchScheduler({ concurrency: { hint: 1 } })

      scheduler.schedule(task('hint:a', 'hint', run('a')))
      scheduler.schedule(task('hint:b', 'hint', run('b')))
      await tick()

      expect(scheduler.inspect!()).toEqual({ active: 1, pending: ['hint:b'] })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('should hold queued tasks while prefetching is unaffordable', async () => {
    const { started, dropped, run, finish } = tracker()
    const canPrefetch = vi.fn(() => true)
    const scheduler = createPrefetchScheduler({ concurrency: { island: 1 }, canPrefetch })

    scheduler.schedule(task('island:a', 'island', run('a')))
    scheduler.schedule(task('island:b', 'island', run('b')))
    await tick()
    expect(started).toEqual(['a'])

    canPrefetch.mockReturnValue(false)
    await finish('a')
    scheduler.schedule(task('island:c', 'island', run('c')))
    await tick()

    expect(started).toEqual(['a'])
    expect(dropped).toEqual([])
  })

  it('should run held tasks once prefetching is affordable again', async () => {
    const { started, dropped, run, finish } = tracker()
    const canPrefetch = vi.fn(() => false)
    const scheduler = createPrefetchScheduler({ concurrency: { island: 1 }, canPrefetch })

    scheduler.schedule(task('island:a', 'island', run('a')))
    scheduler.schedule(task('island:b', 'island', run('b')))
    await tick()
    expect(started).toEqual([])
    expect(dropped).toEqual([])

    canPrefetch.mockReturnValue(true)
    scheduler.resume()
    await tick()
    expect(started).toEqual(['b'])

    await finish('b')
    expect(started).toEqual(['b', 'a'])
    expect(dropped).toEqual([])
  })
})
