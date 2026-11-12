<script setup lang="ts">
// the layout of a parent route applies to the routes nested in it
definePageMeta({
  layout: 'panel',
})
</script>

<template>
  <div id="admin-shell">
    <NuxtPage />
  </div>
</template>
