<script setup lang="ts" vapor>
const outer = ref('vapor wrapper')
</script>

<template>
  <div data-testid="vapor-wrapper">
    <p data-testid="vapor-wrapper-text">
      {{ outer }}
    </p>
    <VdomChild>
      <span data-testid="vapor-slot-content">slot from vapor</span>
    </VdomChild>
  </div>
</template>
