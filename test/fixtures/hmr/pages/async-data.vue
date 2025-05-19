<script setup lang="ts">
const { data } = await useAsyncData(() => {
  console.log('ASYNC_DATA')
  return new Promise((resolve) => { resolve(1) })
})

// HMR_REPLACE
</script>

<template>
  <div data-testId="contents">
    {{ data }}
  </div>
</template>
