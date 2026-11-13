<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const message = props.error.message

onMounted(() => record('error:mount'))
onUnmounted(() => record('error:unmount'))
</script>

<template>
  <div>
    <h1 data-testid="error">
      {{ message }}
    </h1>
    <button
      data-testid="clear"
      @click="clearError({ redirect: '/' })"
    >
      Clear and go home
    </button>
    <button
      data-testid="clear-forbidden"
      @click="clearError({ redirect: '/forbidden' })"
    >
      Clear and go somewhere forbidden
    </button>
  </div>
</template>
