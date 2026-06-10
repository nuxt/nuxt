<template>
  <div>You should not see me</div>
</template>

<script setup lang="ts">
const route = useRoute()
await navigateTo(String(route.query.next || '/'))
</script>
