<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData('search', () => $fetch('/api/search', { query: { q: route.query.q } }))
</script>

<template>
  <div>
    <div data-testid="search">
      {{ data?.q }}
    </div>
    <NuxtLink
      to="/data"
      :prefetch="false"
    >
      data page
    </NuxtLink>
  </div>
</template>
