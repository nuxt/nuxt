<template>
  <slot
    v-if="error"
    :error="error"
    :clear-error="clearError"
    name="error"
  />

  <slot
    v-else
    name="default"
  />
</template>

<script setup lang="ts">
import { onErrorCaptured, shallowRef } from 'vue'
import { useNuxtApp } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

defineOptions({
  name: 'NuxtErrorBoundary',
  inheritAttrs: false,
})

const emit = defineEmits<{
  error: [error: unknown]
}>()

defineSlots<{
  error: (props: { error: Error | null, clearError: () => void }) => void
  default: () => void
}>()

const error = shallowRef<Error | null>(null)

function clearError () {
  error.value = null
}

if (import.meta.client) {
  const nuxtApp = useNuxtApp()

  function handleError (...args: Parameters<Parameters<typeof onErrorCaptured<Error>>[0]>) {
    const [err, instance, info] = args
    emit('error', err)

    nuxtApp.hooks.callHook('vue:error', err, instance, info)

    error.value = err
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

defineExpose({ error, clearError })
</script>
