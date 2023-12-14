import { computed, onBeforeUnmount, ref } from 'vue'
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

/**
 * composable to handle the loading state of the page
 */
export function useLoadingIndicator (opts: Partial<LoadingIndicatorOpts> = {}) {
  const { duration = 2000, throttle = 200 } = opts
  const nuxtApp = useNuxtApp()
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / duration)

  let _timer: any = null
  let _throttle: any = null

  function start () {
    if (nuxtApp.isHydrating) {
      return
    }
    clear()
    progress.value = 0
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

  if (import.meta.client) {
    const unsubLoadingStartHook = nuxtApp.hook('page:loading:start', () => {
      start()
    })
    const unsubLoadingFinishHook = nuxtApp.hook('page:loading:end', () => {
      finish()
    })
    const unsubError = nuxtApp.hook('vue:error', finish)

    onBeforeUnmount(() => {
      unsubError()
      unsubLoadingStartHook()
      unsubLoadingFinishHook()
      clear()
    })
  }

  return {
    progress,
    isLoading,
    start,
    finish,
    clear
  }
}
