<script setup lang="ts">
const event = useRequestEvent()!
event.context.user = 'daniel'
const requestFetch = useRequestFetch()
const { data } = await useAsyncData('fetched-context', () => requestFetch<string>('/context'))
</script>

<template>
  <p id="fetched-context">
    {{ data?.includes('<p id="context">daniel</p>') ? 'seeded with daniel' : 'missing' }}
  </p>
</template>
