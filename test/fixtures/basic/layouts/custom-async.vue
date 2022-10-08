<template>
  <div>
    Custom Async Layout:
    <slot />
  </div>
</template>

<script setup>
await Promise.resolve()
console.log('isHydrating: ' + useNuxtApp().isHydrating)
</script>
