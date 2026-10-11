<script setup lang="ts" vapor>
const { data, status } = useAsyncData('vapor-lazy-data', () => $fetch('/api/greeting?delay=200'), { lazy: true, server: false })
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Lazy data vapor page
    </h1>
    <p data-testid="data-status">
      {{ status }}
    </p>
    <p data-testid="data-greeting">
      {{ data?.greeting ?? 'no data yet' }}
    </p>
  </div>
</template>
