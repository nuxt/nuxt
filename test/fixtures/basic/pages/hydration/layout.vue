<script setup lang="ts">
definePageMeta({
  layout: 'custom-async'
})

if (process.client && !useNuxtApp().isHydrating) {
  throw createError({
    fatal: true,
    message: '`useNuxtApp().isHydrating` is false by the time we run page setup'
  })
}
</script>

<template>
  <div>
    Tests whether hydration is properly resolved within an async layout
  </div>
</template>
