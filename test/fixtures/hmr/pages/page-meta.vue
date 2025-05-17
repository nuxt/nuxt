<script setup lang="ts">
definePageMeta({
  some: 'stuff',
})
</script>

<template>
  <div>
    <pre data-testid="meta">{{ $route.meta }}</pre>
  </div>
</template>
