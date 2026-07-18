<template>
  <div>
    <div>
      <h1>{{ error?.message }}</h1>
      This is the error page 😱
      <div
        v-if="error?.data?.path"
        data-testid="path"
      >
        Path: {{ error.data.path }}
      </div>
      <div
        v-if="error?.cause"
        data-testid="cause"
      >
        Cause: {{ error.cause.message }}
        <div>Cause stack: {{ error.cause.stack }}</div>
      </div>
      <div
        v-if="error?.cause?.cause"
        data-testid="root-cause"
      >
        Root cause: {{ error.cause.cause.message }}
        <div>Root cause stack: {{ error.cause.cause.stack }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

interface ErrorCause {
  message: string
  stack?: string
  cause?: ErrorCause
}

defineProps({
  error: Object as () => NuxtError & { cause?: ErrorCause },
})
</script>
