<script setup lang="ts">
if (import.meta.client) {
  throw new Error('boom while hydrating')
}
</script>

<template>
  <div>hydration boom healthy</div>
</template>
