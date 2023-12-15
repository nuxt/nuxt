import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app/nuxt'

export type LoadingIndicatorOpts = {
  /** @default 2000 */
  duration: number
  /** @default 200 */
  throttle: number
}

function _increase (progress: Ref<number>, num: number) {
  progress.value = Math.min(100, progress.value + num)
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

function createLoadingIndicator (opts: Partial<LoadingIndicatorOpts> = {}) {
  const { duration = 2000, throttle = 200 } = opts
  const nuxtApp = useNuxtApp()
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / duration)

  let _timer: any = null
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
        _startTimer()
      }, throttle)
    } else {
      isLoading.value = true
      _startTimer()
    }
  }

  function finish () {
    progress.value = 100
    clear()
    _hide(isLoading, progress)
  }

  function clear () {
    clearInterval(_timer)
    clearTimeout(_throttle)
    _timer = null
    _throttle = null
  }

  function _startTimer () {
    if (import.meta.client) {
      _timer = setInterval(() => { _increase(progress, step.value) }, 100)
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
