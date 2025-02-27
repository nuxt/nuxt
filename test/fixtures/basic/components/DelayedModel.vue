<template>
  <div>
    <span data-testid="count">{{ model }}</span>
    <button
      data-testid="increment"
      @click="model++"
    >
      Increment
    </button>
  </div>
</template>

<script setup lang="ts">
const model = defineModel<number>()
</script>
