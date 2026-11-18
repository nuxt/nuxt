<script setup lang="ts">
const error = useError()
</script>

<template>
  <div>
    <h1 data-testid="error">
      {{ error!.message }}
    </h1>
    <button
      data-testid="clear-forbidden"
      @click="clearError({ redirect: '/forbidden' })"
    >
      Clear and go somewhere forbidden
    </button>
  </div>
</template>
