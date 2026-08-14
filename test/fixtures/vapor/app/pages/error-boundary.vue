<script setup lang="ts">
const showThrowing = ref(false)
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      NuxtErrorBoundary
    </h1>
    <NuxtErrorBoundary>
      <VaporThrowsHandler />
      <template #error="{ error, clearError }">
        <div data-testid="handler-error">
          {{ error }}
        </div>
        <button
          data-testid="handler-clear"
          @click="clearError"
        >
          clear
        </button>
      </template>
    </NuxtErrorBoundary>
    <button
      data-testid="mount-throwing"
      @click="showThrowing = true"
    >
      mount throwing component
    </button>
    <NuxtErrorBoundary>
      <VaporThrowsSetup v-if="showThrowing" />
      <template #error="{ error }">
        <div data-testid="setup-error">
          {{ error }}
        </div>
      </template>
    </NuxtErrorBoundary>
  </div>
</template>
