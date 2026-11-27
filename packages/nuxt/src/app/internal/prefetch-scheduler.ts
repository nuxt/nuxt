import type { Router } from 'vue-router'
import { createPrefetchScheduler } from './prefetch'
import type { PrefetchPriority, PrefetchScheduler } from './prefetch'
import { canPrefetch, prefetchGroup } from './prefetch-util'
import { requestIdleCallback } from '../compat/idle-callback'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp } from '../nuxt'

type NavigatorWithConnection = Navigator & { connection?: EventTarget }

const IDLE_START_TIMEOUT_MS = 1000

interface SchedulerLike {
  postTask?: (callback: () => void, options?: { priority?: 'background' }) => Promise<unknown>
}

/**
 * Speculative work yields to user input. Work the user has shown intent in does not, and
 * neither do route chunks, whose start latency is what a navigation ends up waiting on.
 * https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
 */
function defer (run: () => void, promoted: boolean, priority: PrefetchPriority) {
  if (promoted || priority === 'route') { return run() }
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler
  // no `postTask` signal: a cancelled task still has to run to settle and free its slot, and
  // reads the abort from its own signal
  if (scheduler?.postTask) {
    scheduler.postTask(run, { priority: 'background' }).catch(() => {})
  } else {
    // an idle callback can be starved indefinitely on a busy main thread
    requestIdleCallback(run, { timeout: IDLE_START_TIMEOUT_MS })
  }
}

/**
 * The single scheduler every client-side prefetch mechanism queues work on.
 * @internal
 */
export function usePrefetchScheduler (nuxtApp: NuxtApp = useNuxtApp()): PrefetchScheduler {
  if (nuxtApp._prefetch) { return nuxtApp._prefetch }
  // a hidden tab shows nothing to speculate about, and a navigation waits on a request of its own
  let navigating = false
  let watchingConnection = false
  const scheduler = createPrefetchScheduler({
    canPrefetch: () => {
      if (canPrefetch()) { return !navigating && document.visibilityState !== 'hidden' }
      if (!watchingConnection) {
        watchingConnection = true
        ;(navigator as NavigatorWithConnection).connection?.addEventListener?.('change', () => scheduler.resume())
      }
      return false
    },
    defer,
  })
  nuxtApp._prefetch = scheduler
  document.addEventListener('visibilitychange', () => scheduler.resume())
  const router = nuxtApp.$router as unknown as Router
  router.beforeEach(() => { navigating = true })
  router.afterEach((to) => {
    navigating = false
    scheduler.reset(prefetchGroup(to.fullPath))
  })
  // a guard that throws resolves through `onError` rather than `afterEach`
  router.onError(() => {
    navigating = false
    scheduler.resume()
  })
  return scheduler
}
