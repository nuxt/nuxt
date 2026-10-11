<script setup lang="ts" vapor>
const { data } = await useAsyncData('vapor-slow-data', () => $fetch('/api/greeting?delay=800'))
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Slow vapor page
    </h1>
    <p data-testid="data-greeting">
      {{ data?.greeting }}
    </p>
  </div>
</template>
