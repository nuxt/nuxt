import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app/nuxt'

export type LoadingIndicatorOpts = {
  /** @default 2000 */
  duration: number
  /** @default 200 */
  throttle: number
  /** @default 50 */
  progressionRate: number
}

function _hide (isLoading: Ref<boolean>, progress: Ref<number>) {
  if (import.meta.client) {
    setTimeout(() => {
      isLoading.value = false
      setTimeout(() => { progress.value = 0 }, 400)
    }, 500)
  }
}

export type LoadingIndicator = {
  _cleanup: () => void
  progress: Ref<number>
  isLoading: Ref<boolean>
  start: () => void
  set: (value: number) => void
  finish: () => void
  clear: () => void
}

function _progressTimingFunction (duration: number, elapsed: number, progressionRate: number = 50): number {
  const completionPercentage = elapsed / duration * 100
  return (2 / Math.PI * 100) * Math.atan(completionPercentage / progressionRate)
}

function createLoadingIndicator (opts: Partial<LoadingIndicatorOpts> = {}) {
  const { duration = 2000, throttle = 200 } = opts
  const progressionRate = opts.progressionRate && Number.isInteger(opts.progressionRate) ? opts.progressionRate : 50
  const normalizedProgressionRate = Math.max(0, Math.min(100, progressionRate)) / 2 + 25 // from 25 to 75
  const nuxtApp = useNuxtApp()
  const progress = ref(0)
  const isLoading = ref(false)
  let done = false
  let rafId: number

  let _throttle: any = null

  const start = () => set(0)

  function set (at = 0) {
    if (nuxtApp.isHydrating) {
      return
    }
    if (at >= 100) { return finish() }
    clear()
    progress.value = at < 0 ? 0 : at
    if (throttle && import.meta.client) {
      _throttle = setTimeout(() => {
        isLoading.value = true
        _startProgress()
      }, throttle)
    } else {
      isLoading.value = true
      _startProgress()
    }
  }

  function finish () {
    progress.value = 100
    done = true
    clear()
    _hide(isLoading, progress)
  }

  function clear () {
    clearTimeout(_throttle)
    cancelAnimationFrame(rafId)
    _throttle = null
  }

  function _startProgress () {
    done = false
    let startTimeStamp: number

    function step (timeStamp: number): void {
      if (done) { return }

      startTimeStamp ??= timeStamp
      const elapsed = timeStamp - startTimeStamp
      const value = _progressTimingFunction(duration, elapsed, normalizedProgressionRate)
      progress.value = Math.min(100, value)
      rafId = requestAnimationFrame(step)
    }

    if (import.meta.client) {
      rafId = requestAnimationFrame(step)
    }
  }

  let _cleanup = () => {}
  if (import.meta.client) {
    const unsubLoadingStartHook = nuxtApp.hook('page:loading:start', () => {
      start()
    })
    const unsubLoadingFinishHook = nuxtApp.hook('page:loading:end', () => {
      finish()
    })
    const unsubError = nuxtApp.hook('vue:error', finish)

    _cleanup = () => {
      unsubError()
      unsubLoadingStartHook()
      unsubLoadingFinishHook()
      clear()
    }
  }

  return {
    _cleanup,
    progress: computed(() => progress.value),
    isLoading: computed(() => isLoading.value),
    start,
    set,
    finish,
    clear
  }
}

/**
 * composable to handle the loading state of the page
 * @since 3.9.0
 */
export function useLoadingIndicator (opts: Partial<LoadingIndicatorOpts> = {}): Omit<LoadingIndicator, '_cleanup'> {
  const nuxtApp = useNuxtApp()

  // Initialise global loading indicator if it doesn't exist already
  const indicator = nuxtApp._loadingIndicator = nuxtApp._loadingIndicator || createLoadingIndicator(opts)
  if (import.meta.client && getCurrentScope()) {
    nuxtApp._loadingIndicatorDeps = nuxtApp._loadingIndicatorDeps || 0
    nuxtApp._loadingIndicatorDeps++
    onScopeDispose(() => {
      nuxtApp._loadingIndicatorDeps!--
      if (nuxtApp._loadingIndicatorDeps === 0) {
        indicator._cleanup()
        delete nuxtApp._loadingIndicator
      }
    })
  }

  return indicator
}
