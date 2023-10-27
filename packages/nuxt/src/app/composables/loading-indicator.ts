import { computed, onBeforeUnmount, ref } from 'vue'
import { useNuxtApp } from '#app/nuxt'

export function useLoadingIndicator (opts: {
    duration: number,
    throttle: number
  }) {
  const nuxtApp = useNuxtApp()
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / opts.duration)

  let _timer: any = null
  let _throttle: any = null

  function start () {
    if (nuxtApp.isHydrating) {
      return
    }
    clear()
    progress.value = 0
    if (opts.throttle && import.meta.client) {
      _throttle = setTimeout(() => {
        isLoading.value = true
        _startTimer()
      }, opts.throttle)
    } else {
      isLoading.value = true
      _startTimer()
    }
  }
  function finish () {
    progress.value = 100
    _hide()
  }

  function clear () {
    clearInterval(_timer)
    clearTimeout(_throttle)
    _timer = null
    _throttle = null
  }

  function _increase (num: number) {
    progress.value = Math.min(100, progress.value + num)
  }

  function _hide () {
    clear()
    if (import.meta.client) {
      setTimeout(() => {
        isLoading.value = false
        setTimeout(() => { progress.value = 0 }, 400)
      }, 500)
    }
  }

  function _startTimer () {
    if (import.meta.client) {
      _timer = setInterval(() => { _increase(step.value) }, 100)
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
