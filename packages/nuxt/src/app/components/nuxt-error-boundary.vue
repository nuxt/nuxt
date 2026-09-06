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
import { getCurrentInstance, nextTick, onErrorCaptured, onMounted, shallowRef, useId } from 'vue'
import { useNuxtApp } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useState } from '../composables/state'
import type { NuxtError } from '../composables/error'
import { createIdScope } from './utils'
import { ssrErrorBoundary } from '#build/nuxt.config.mjs'

defineOptions({
  name: 'NuxtErrorBoundary',
  inheritAttrs: false,
})

const props = defineProps<{
  /**
   * When the error was caught during server-side rendering, re-render the default slot on the
   * client once mounted (falling back to the `#error` slot again if it throws there too).
   */
  retryOnClient?: boolean
}>()

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
  // the re-render after an SSR error is a normal client patch, not hydration
  let retrying = false

  if (ssrErrorBoundary) {
    // written by the server component when its default slot threw
    const ssrError = useState<NuxtError | undefined>(useId())
    createIdScope(getCurrentInstance()!)
    if (ssrError.value) {
      error.value = ssrError.value
      ssrError.value = undefined

      if (props.retryOnClient) {
        onMounted(() => {
          retrying = true
          clearError()
          nextTick(() => { retrying = false })
        })
      }
    }
  }

  function handleError (...args: Parameters<Parameters<typeof onErrorCaptured<Error>>[0]>) {
    const [err, instance, info] = args

    emit('error', err)

    nuxtApp.hooks.callHook('vue:error', err, instance, info)

    error.value = err
  }

  onErrorCaptured((err, instance, info) => {
    if (retrying || !nuxtApp.isHydrating) {
      handleError(err, instance, info)
    } else {
      onNuxtReady(() => handleError(err, instance, info))
    }

    return false
  })
}

defineExpose({ error, clearError })
</script>
