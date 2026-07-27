<script setup lang="ts">
// https://github.com/nuxt/nuxt/issues/34763
// Lives in a sibling layer outside the consuming fixture's rootDir. The marker
// value is edited at runtime by the HMR e2e test; SSR must observe the new
// value on the next request.
const marker = 'v1'
</script>

<template>
  <span data-testid="sibling-marker">{{ marker }}</span>
</template>
