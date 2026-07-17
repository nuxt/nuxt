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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'
import { useHead } from '#imports'

const props = defineProps({
  error: Object as () => NuxtError,
})

useHead(() => ({
  title: `${props.error?.statusCode || 500} - ${props.error?.statusMessage || 'Error'} | Basic Error Page`,
}))
</script>
