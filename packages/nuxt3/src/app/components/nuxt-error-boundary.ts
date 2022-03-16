import { defineComponent, ref, onErrorCaptured } from 'vue'
import { useNuxtApp } from '#app'

export default defineComponent({
  setup (_props, { slots, emit }) {
    const error = ref(null)
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
