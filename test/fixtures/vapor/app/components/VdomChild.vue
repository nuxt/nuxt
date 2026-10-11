<script setup lang="ts">
const message = ref('vdom child')
</script>

<template>
  <div data-testid="vdom-child">
    {{ message }}
    <slot />
  </div>
</template>
