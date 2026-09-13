<script setup lang="ts">
definePageMeta({
  layout: 'other',
})
</script>

<template>
  <div>
    <h1 data-testid="slow-other-title">
      slow page in other layout
    </h1>
    <HydrationBlocker />
  </div>
</template>
