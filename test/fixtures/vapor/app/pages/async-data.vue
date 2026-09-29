<script setup lang="ts" vapor>
const { data, status, refresh } = await useAsyncData('vapor-async-data', () => $fetch('/api/greeting'))
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Async data vapor page
    </h1>
    <p data-testid="data-greeting">
      {{ data?.greeting }}
    </p>
    <p data-testid="data-count">
      count: {{ data?.requestCount }}
    </p>
    <p data-testid="data-status">
      {{ status }}
    </p>
    <button
      data-testid="refresh-button"
      @click="refresh()"
    >
      refresh
    </button>
  </div>
</template>
