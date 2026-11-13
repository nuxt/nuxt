<script lang="ts">
// runs when the chunk is evaluated, which a prefetch must not do
performance.mark('evaluated:page')
</script>

<script setup lang="ts">
definePageMeta({ layout: 'alt' })
</script>

<template>
  <h1 id="other-page">
    Other page
  </h1>
</template>

<style>
body {
  accent-color: rgb(4, 5, 6);
}
</style>
