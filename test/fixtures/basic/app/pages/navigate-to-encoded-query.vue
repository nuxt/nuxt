<template>
  <div>You should not see me</div>
</template>

<script setup lang="ts">
// This should trigger a redirect to /redirect-target?callback=/other
// The query parameter contains a path that should be preserved
await navigateTo('/redirect-target?callback=/other', { redirectCode: 302 })
</script>
