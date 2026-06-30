<template>
  <div>You should not see me</div>
</template>

<script setup lang="ts">
await navigateTo({ path: '/navigate-some-path', query: { a: 'a', b: 'b', c: 'c' } })
</script>
