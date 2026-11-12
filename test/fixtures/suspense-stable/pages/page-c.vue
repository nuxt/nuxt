<script setup lang="ts">
</script>

<template>
  <div>
    <h1 data-testid="page-c-title">Page C</h1>
    <p data-testid="page-c-content">Content from page C (fast, no async)</p>
    <NuxtLink to="/" data-testid="back-home">
      Back to Home
    </NuxtLink>
  </div>
</template>
