<script setup lang="ts">
const route = useRoute()
if (import.meta.client) {
  Promise.reject('failure' in route.query ? 'failure' : new Error('boom while navigating'))
  await new Promise(resolve => setTimeout(resolve, 200))
}
</script>

<template>
  <div>
    rejects on load
  </div>
</template>
