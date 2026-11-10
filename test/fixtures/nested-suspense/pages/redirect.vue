<script setup lang="ts">
definePageMeta({
  pageTransition: false,
  layoutTransition: false,
})

await navigateTo('/target')
</script>

<template>
  <div data-testid="redirect-page">
    Redirecting...
  </div>
</template>
