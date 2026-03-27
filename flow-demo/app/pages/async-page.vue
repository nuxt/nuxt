<script setup lang="ts">
const title = await Promise.resolve('Async Title')
definePageMeta({
  title,
})
</script>

<template>
  <div>
    <NuxtLink to="/">Back</NuxtLink>
    <h1>Async Page</h1>
  </div>
</template>
