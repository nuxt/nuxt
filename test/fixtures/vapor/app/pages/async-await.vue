<script setup lang="ts" vapor>
await new Promise(resolve => setTimeout(resolve, 50))
const message = 'resolved after await'
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Async await vapor page
    </h1>
    <p data-testid="await-message">
      {{ message }}
    </p>
  </div>
</template>
