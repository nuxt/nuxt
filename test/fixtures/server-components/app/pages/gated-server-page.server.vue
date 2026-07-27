<template>
  <div id="gated-server-page">
    SUPER-SECRET-PAGE-ISLAND-BODY
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'island-auth',
})
</script>
