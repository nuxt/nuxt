<template>
  <div>
    async-parent
    <NuxtPage />
  </div>
</template>

<script setup>
await Promise.resolve()
if (import.meta.client) {
  console.log('isHydrating: ' + useNuxtApp().isHydrating)
}
definePageMeta({
  layout: 'custom'
})
</script>
