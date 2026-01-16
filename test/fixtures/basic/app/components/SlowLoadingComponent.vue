<template>
  <div class="slow-component-loaded">
    Slow component loaded!
  </div>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, 100))
</script>
