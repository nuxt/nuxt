<template>
  <div>should not render</div>
</template>

<script setup lang="ts">
await $fetch('/api/upstream-failure?token=upstream-token')
</script>
