<script setup lang="ts">
definePageMeta({
  middleware: () => '/hydration/spa-redirection/end'
})
</script>

<template>
  <div>
    Tests whether hydration is properly resolved when loading
  </div>
</template>
