<template>
  <div>
    Custom Async Layout:
    <slot />
    <ComponentWithRef />
  </div>
</template>

<script setup>
await Promise.resolve()
if (import.meta.client) {
  console.log('isHydrating: ' + useNuxtApp().isHydrating)
}
</script>
