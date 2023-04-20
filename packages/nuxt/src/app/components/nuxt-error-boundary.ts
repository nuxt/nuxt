import { defineComponent, onErrorCaptured, ref } from 'vue'
import { useNuxtApp } from '#app/nuxt'

export default defineComponent({
  emits: {
    error (_error: unknown) {
      return true
    }
  },
  setup (_props, { slots, emit }) {
    const error = ref<Error | null>(null)
    const nuxtApp = useNuxtApp()

    onErrorCaptured((err) => {
      if (process.client && !nuxtApp.isHydrating) {
        emit('error', err)
        error.value = err
        return false
      }
    })

    return () => error.value ? slots.error?.({ error }) : slots.default?.()
  }
})
