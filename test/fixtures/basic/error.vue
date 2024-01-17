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
defineProps({
  error: Object as () => NuxtError
})
</script>
