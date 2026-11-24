<script setup lang="ts">
const requestFetch = useRequestFetch()
const { data } = await useAsyncData('fetched', () => requestFetch<string>('/about'))
</script>

<template>
  <p id="fetched">
    {{ data?.includes('about page') ? 'fetched the about page' : 'missing' }}
  </p>
</template>
