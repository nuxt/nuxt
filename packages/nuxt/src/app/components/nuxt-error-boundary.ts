import { defineComponent, onErrorCaptured, ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import { onNuxtReady } from '../../app'

export default defineComponent({
  name: 'NuxtErrorBoundary',
  inheritAttrs: false,
  emits: {
    error (_error: unknown) {
      return true
    },
  },
  setup (_props, { slots, emit }) {
    const error = ref<Error | null>(null)

    if (import.meta.client) {
      const nuxtApp = useNuxtApp()

      function handleError (...args: Parameters<Parameters<typeof onErrorCaptured>[0]>) {
        const [err, instance, info] = args
        emit('error', err)

        nuxtApp.hooks.callHook('vue:error', err, instance, info)

        error.value = err as Error
      }

      onErrorCaptured((err, instance, info) => {
        if (!nuxtApp.isHydrating) {
          handleError(err, instance, info)
        } else {
          onNuxtReady(() => handleError(err, instance, info))
        }

        return false
      })
    }

    function clearError () {
      error.value = null
    }

    return () => error.value ? slots.error?.({ error, clearError }) : slots.default?.()
  },
})
