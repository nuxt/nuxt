<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [() => setPageLayout('custom')],
})
</script>

<template>
  <div id="set-page-layout">
    Page content
  </div>
</template>
