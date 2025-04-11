import { type ComponentPublicInstance, defineComponent, onErrorCaptured, ref } from 'vue'
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
    const nuxtApp = useNuxtApp()

    function handleError (err: Error, instance: ComponentPublicInstance | null, info: string) {
      emit('error', err)

      nuxtApp.hooks.callHook('vue:error', err, instance, info)
      error.value = err
    }

    if (import.meta.client) {
      onErrorCaptured((err, instance, info) => {
        if (nuxtApp.isHydrating) {
          onNuxtReady(() => handleError(err, instance, info))

          return false
        }

        if (!nuxtApp.isHydrating || !nuxtApp.payload.serverRendered) {
          handleError(err, instance, info)

          return false
        }
      })
    }

    function clearError () {
      error.value = null
    }

    return () => error.value ? slots.error?.({ error, clearError }) : slots.default?.()
  },
})
