<script setup lang="ts">
defineProps<{ count: number }>()
</script>

<template>
  <div data-testid="client-count">
    <span>count: {{ count }}</span>
  </div>
</template>
