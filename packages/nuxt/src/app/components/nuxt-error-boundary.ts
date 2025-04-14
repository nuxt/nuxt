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

      onErrorCaptured((err, instance, info) => {
        onNuxtReady(() => {
          emit('error', err)

          nuxtApp.hooks.callHook('vue:error', err, instance, info)

          error.value = err
        })

        return false
      })
    }

    function clearError () {
      error.value = null
    }

    return () => error.value ? slots.error?.({ error, clearError }) : slots.default?.()
  },
})
