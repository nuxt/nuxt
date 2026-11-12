<template>
  <slot
    v-if="error"
    v-bind="{ error, clearError }"
    name="error"
  />

  <slot
    v-else
    name="default"
  />
</template>

<script setup lang="ts">
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { useNuxtApp } from '../nuxt'
import { useRouter } from '../composables/router'
import { onNuxtReady } from '../composables/ready'

defineOptions({
  name: 'NuxtErrorBoundary',
  inheritAttrs: false,
})

const emit = defineEmits<{
  error: [error: Error]
}>()

defineSlots<{
  error(props: { error: Error, clearError: () => void }): any
  default(): any
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

  // Recover the boundary on navigation. Uses the router's current route, not
  // `useRoute()` (Suspense-synced, so stale while a page is erroring) (#15781).
  const router = useRouter()
  watch(() => router.currentRoute.value.fullPath, () => { clearError() })
}

defineExpose({ error, clearError })
</script>
