/** drained in this order */
const PREFETCH_PRIORITIES = ['route', 'payload', 'island', 'hint'] as const

export type PrefetchPriority = typeof PREFETCH_PRIORITIES[number]

export interface PrefetchTask {
  /** A task whose key is already queued or in flight is dropped. */
  key: string
  priority: PrefetchPriority
  /** `navigation` tasks are aborted and dequeued when the app navigates. */
  scope: 'navigation' | 'app'
  /** The destination this work belongs to. Promoted together, and retained across a navigation to it. */
  group?: string
  /**
   * Runs exactly once, so that callers can rely on its result settling. A dropped task (a
   * duplicate key, or dequeued by a navigation) is run with an aborted signal rather than
   * given a slot.
   */
  run: (signal: AbortSignal, promoted: boolean) => unknown | Promise<unknown>
}

interface PrefetchSchedulerOptions {
  total?: number
  /** Per-priority caps keep one kind of work, such as slow resource hints, off the whole budget. */
  concurrency?: Partial<Record<PrefetchPriority, number>>
  /** Consulted before each drain; queued tasks are held, not dropped, when it returns `false`. */
  canPrefetch?: () => boolean
  /** Hands a started task to the event loop. Slots are accounted for before this is called. */
  defer?: (run: () => void, promoted: boolean, priority: PrefetchPriority) => void
}

export interface PrefetchScheduler {
  /** A batch is queued ahead of work already queued at the same priority, keeping its own order. */
  schedule: (task: PrefetchTask | PrefetchTask[]) => void
  /** Move every queued task in this group to the front of its priority. */
  promote: (group: string) => void
  /**
   * Abort in-flight `navigation` tasks and drop queued ones, except work for `retainGroup`.
   * Its forwarded hints go too, as a destination re-declares those itself once it is current.
   */
  reset: (retainGroup?: string) => void
  /** Drain again, once something that was holding work back has changed. */
  resume: () => void
  /** @internal */
  inspect?: () => { active: number, pending: string[] }
}

const DEFAULT_TOTAL_CONCURRENCY = 12

const DEFAULT_CONCURRENCY: Record<PrefetchPriority, number> = {
  route: 8,
  payload: 8,
  island: 4,
  hint: 8,
}

export function createPrefetchScheduler (options: PrefetchSchedulerOptions = {}): PrefetchScheduler {
  const limits = { ...DEFAULT_CONCURRENCY, ...options.concurrency }
  const total = options.total ?? DEFAULT_TOTAL_CONCURRENCY
  const canPrefetch = options.canPrefetch
  const defer = options.defer

  // queued newest-first within each priority, so the most recently seen link is served next
  const queues: Record<PrefetchPriority, PrefetchTask[]> = { route: [], payload: [], island: [], hint: [] }
  const lists = PREFETCH_PRIORITIES.map(priority => queues[priority])
  const promoted = new WeakSet<PrefetchTask>()
  // tracks which task owns a key, so that one settling late cannot release the key of its replacement
  const keys = new Map<string, PrefetchTask>()
  const active: Record<PrefetchPriority, number> = { route: 0, payload: 0, island: 0, hint: 0 }
  let activeTotal = 0
  const activeNavigationTasks = new Map<PrefetchTask, AbortController>()

  const appController = new AbortController()
  const droppedController = new AbortController()
  droppedController.abort()

  function release (task: PrefetchTask) {
    if (keys.get(task.key) === task) {
      keys.delete(task.key)
    }
  }

  function drop (task: PrefetchTask) {
    release(task)
    Promise.resolve().then(() => task.run(droppedController.signal, false)).catch(() => {})
  }

  function drain () {
    // held, not dropped: nothing re-fires prefetch work once a link has been prefetched
    if (canPrefetch && !canPrefetch()) { return }
    while (activeTotal < total) {
      const priority = PREFETCH_PRIORITIES.find(priority => queues[priority].length && active[priority] < limits[priority])
      if (!priority) { return }
      const task = queues[priority].shift()!
      start(task, promoted.delete(task))
    }
  }

  function start (task: PrefetchTask, isPromoted: boolean) {
    const controller = task.scope === 'app' ? appController : new AbortController()
    if (task.scope === 'navigation') {
      activeNavigationTasks.set(task, controller)
    }
    active[task.priority]++
    activeTotal++
    const complete = () => {
      active[task.priority]--
      activeTotal--
      activeNavigationTasks.delete(task)
      release(task)
      drain()
    }
    const run = () => Promise.resolve()
      .then(() => task.run(controller.signal, isPromoted))
      .then(complete, complete)
    if (defer) {
      defer(run, isPromoted, task.priority)
    } else {
      run()
    }
  }

  const isRetained = (task: PrefetchTask, retainGroup?: string) => retainGroup !== undefined && task.group === retainGroup && task.priority !== 'hint'

  const scheduler: PrefetchScheduler = {
    schedule (task) {
      const batch: PrefetchTask[] = []
      for (const candidate of Array.isArray(task) ? task : [task]) {
        if (keys.has(candidate.key)) {
          drop(candidate)
          continue
        }
        keys.set(candidate.key, candidate)
        batch.push(candidate)
      }
      for (let i = batch.length - 1; i >= 0; i--) {
        queues[batch[i]!.priority].unshift(batch[i]!)
      }
      drain()
    },
    promote (group) {
      for (const list of lists) {
        const wanted: PrefetchTask[] = []
        const rest: PrefetchTask[] = []
        for (const task of list) {
          if (task.group === group) { promoted.add(task) }
          ;(task.group === group ? wanted : rest).push(task)
        }
        list.length = 0
        list.push(...wanted, ...rest)
      }
      drain()
    },
    reset (retainGroup) {
      for (const list of lists) {
        for (let i = list.length - 1; i >= 0; i--) {
          const task = list[i]!
          if (task.scope === 'navigation' && !isRetained(task, retainGroup)) {
            list.splice(i, 1)
            drop(task)
          }
        }
      }
      for (const [task, controller] of activeNavigationTasks) {
        if (isRetained(task, retainGroup)) { continue }
        // an aborted task may never settle, so release its key immediately
        release(task)
        activeNavigationTasks.delete(task)
        controller.abort()
      }
      drain()
    },
    resume: drain,
  }

  if (import.meta.dev) {
    scheduler.inspect = () => ({ active: activeTotal, pending: lists.flatMap(list => list.map(task => task.key)) })
  }

  return scheduler
}
