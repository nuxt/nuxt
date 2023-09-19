<template>
  <div>
    another-parent/child
  </div>
</template>

<script setup>
await Promise.resolve()
// eslint-disable-next-line no-console
process.client && console.log('isHydrating: ' + useNuxtApp().isHydrating)
definePageMeta({
  layout: 'custom-async'
})
</script>
