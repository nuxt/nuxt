<template>
  <div>
    Custom Async Layout:
    <slot />
    <ComponentWithRef />
  </div>
</template>

<script setup>
await Promise.resolve()
// eslint-disable-next-line no-console
process.client && console.log('isHydrating: ' + useNuxtApp().isHydrating)
</script>
