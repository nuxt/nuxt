<script setup lang="ts">
const renderId = Math.random().toString(36).slice(2)
</script>

<template>
  <div id="prerender-dedupe">
    {{ renderId }}
  </div>
</template>
