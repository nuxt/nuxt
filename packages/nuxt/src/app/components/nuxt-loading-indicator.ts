import { computed, defineComponent, h, onBeforeUnmount, ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import { useRouter } from '../composables/router'
import { isChangingPage } from './utils'

// @ts-expect-error virtual file
import { globalMiddleware } from '#build/middleware'

export default defineComponent({
  name: 'NuxtLoadingIndicator',
  props: {
    throttle: {
      type: Number,
      default: 200
    },
    duration: {
      type: Number,
      default: 2000
    },
    height: {
      type: Number,
      default: 3
    },
    color: {
      type: [String, Boolean],
      default: 'repeating-linear-gradient(to right,#00dc82 0%,#34cdfe 50%,#0047e1 100%)'
    }
  },
  setup (props, { slots }) {
    // TODO: use computed values in useLoadingIndicator
    const { progress, isLoading, start, finish, clear } = useLoadingIndicator({
      duration: props.duration,
      throttle: props.throttle
    })

    if (import.meta.client) {
      // Hook to app lifecycle
      // TODO: Use unified loading API
      const nuxtApp = useNuxtApp()
      const router = useRouter()

      globalMiddleware.unshift(start)
      router.onError(() => {
        finish()
      })
      router.beforeResolve((to, from) => {
        if (!isChangingPage(to, from)) {
          finish()
        }
      })

      router.afterEach((_to, _from, failure) => {
        if (failure) {
          finish()
        }
      })

      const unsubPage = nuxtApp.hook('page:finish', finish)
      const unsubError = nuxtApp.hook('vue:error', finish)

      onBeforeUnmount(() => {
        const index = globalMiddleware.indexOf(start)
        if (index >= 0) {
          globalMiddleware.splice(index, 1)
        }
        unsubPage()
        unsubError()
        clear()
      })
    }

    return () => h('div', {
      class: 'nuxt-loading-indicator',
      style: {
        position: 'fixed',
        top: 0,
        right: 0,
        left: 0,
        pointerEvents: 'none',
        width: 'auto',
        height: `${props.height}px`,
        opacity: isLoading.value ? 1 : 0,
        background: props.color || undefined,
        backgroundSize: `${(100 / progress.value) * 100}% auto`,
        transform: `scaleX(${progress.value}%)`,
        transformOrigin: 'left',
        transition: 'transform 0.1s, height 0.4s, opacity 0.4s',
        zIndex: 999999
      }
    }, slots)
  }
})

function useLoadingIndicator (opts: {
  duration: number,
  throttle: number
}) {
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / opts.duration)

  let _timer: any = null
  let _throttle: any = null

  function start () {
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

  return {
    progress,
    isLoading,
    start,
    finish,
    clear
  }
}
