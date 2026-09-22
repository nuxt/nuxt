import type { Router } from 'vue-router'
import { createPrefetchScheduler } from './prefetch'
import type { PrefetchScheduler } from './prefetch'
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
 * Speculative work yields to user input; work the user has shown intent in does not.
 * https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
 */
function defer (run: () => void, promoted: boolean) {
  if (promoted) { return run() }
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler
  // no `postTask` signal: a cancelled task still has to run to settle and release its slot,
  // and reads the abort from its own signal
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
  // a hidden tab is not speculating about anything the user can see
  const scheduler = createPrefetchScheduler({
    canPrefetch: () => canPrefetch() && document.visibilityState !== 'hidden',
    defer,
  })
  nuxtApp._prefetch = scheduler
  // held work needs a trigger to drain again; browsers without `connection` never hold for it
  const connection = (navigator as NavigatorWithConnection).connection
  connection?.addEventListener?.('change', () => scheduler.resume())
  document.addEventListener('visibilitychange', () => scheduler.resume())
  const router = nuxtApp.$router as unknown as Router
  router.afterEach(to => scheduler.reset(prefetchGroup(to.fullPath)))
  return scheduler
}
