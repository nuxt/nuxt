<script setup>
// Rendered component, but this element is absent from the server DOM. Its styles
// must survive so they are present once the element appears after hydration.
const show = ref(false)
</script>

<template>
  <div
    v-if="show"
    class="client-only"
  >
    shown after hydration
  </div>
</template>

<style scoped>
.client-only {
  --hydration-token: present;
}
</style>
