<template>
  <div>
    another-parent/child
  </div>
</template>

<script setup>
await Promise.resolve()
console.log('isHydrating: ' + useNuxtApp().isHydrating)
definePageMeta({
  layout: 'custom-async'
})
</script>
