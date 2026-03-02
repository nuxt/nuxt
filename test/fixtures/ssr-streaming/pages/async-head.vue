<template>
  <div>
    <h1 data-testid="title">
      Async Head Page
    </h1>
    <p data-testid="content">
      {{ data }}
    </p>
  </div>
</template>

<script setup lang="ts">
const { data } = await useAsyncData('async-head', async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  return 'async-loaded'
})

useHead({ title: 'Async Head Title', meta: [{ name: 'description', content: 'Async description from suspense' }] })
</script>
