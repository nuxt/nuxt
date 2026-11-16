<script setup lang="ts">
const error = useError()

onMounted(() => record('error:mount'))
onUnmounted(() => record('error:unmount'))
</script>

<template>
  <div>
    <h1 data-testid="error">
      {{ error!.message }}
    </h1>
    <button
      data-testid="clear"
      @click="clearError({ redirect: '/' })"
    >
      Clear and go home
    </button>
    <button
      data-testid="clear-pending"
      @click="clearError({ redirect: '/?pending' })"
    >
      Clear and go home slowly
    </button>
    <button
      data-testid="clear-forbidden"
      @click="clearError({ redirect: '/forbidden' })"
    >
      Clear and go somewhere forbidden
    </button>
  </div>
</template>
