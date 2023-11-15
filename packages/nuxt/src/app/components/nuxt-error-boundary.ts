import { defineComponent, onErrorCaptured, ref } from 'vue'
import { useNuxtApp } from '../nuxt'

export default defineComponent({
  emits: {
    error (_error: unknown) {
      return true
    }
  },
  setup (_props, { slots, emit }) {
    const error = ref<Error | null>(null)
    const nuxtApp = useNuxtApp()

    onErrorCaptured((err, target, info) => {
      if (import.meta.client && !nuxtApp.isHydrating) {
        emit('error', err)
        nuxtApp.hooks.callHook('vue:error', err, target, info)
        error.value = err
        return false
      }
    })

    function clearError () {
      error.value = null
    }

    return () => error.value ? slots.error?.({ error, clearError }) : slots.default?.()
  }
})
