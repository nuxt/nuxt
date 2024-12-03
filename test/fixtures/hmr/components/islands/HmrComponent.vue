<script lang="ts" setup>
const hmrId = ref(0)
</script>

<template>
  <div>
    HMR ID:
    <span data-testid="hmr-id">{{ hmrId }}</span>
  </div>
</template>
