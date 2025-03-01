<script setup lang="ts">
const loading = useState(() => true)

useHead({
  bodyAttrs: {
    class: () => (loading.value ? 'yellow' : ''),
  },
})

const head = injectHead()
const _ = head.hooks.hookOnce('dom:rendered', () => {
  loading.value = false
})

onUnmounted(_)
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>
    Nuxt Playground
  </div>
</template>

<style>
.yellow {
  background: yellow;
}
</style>
