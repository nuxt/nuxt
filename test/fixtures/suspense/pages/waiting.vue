<script setup lang="ts">
// Simulate async data loading – the regression in nuxt/nuxt#23232 surfaces
// when navigating into a route whose setup awaits.
await new Promise(resolve => setTimeout(resolve, 100))
</script>

<template>
  <div class="test-component">
    <h2 data-testid="waiting-title">
      Waiting (top level, awaits in setup)
    </h2>
  </div>
</template>
