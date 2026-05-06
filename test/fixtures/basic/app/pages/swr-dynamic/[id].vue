<template>
  <div>
    <h1>SWR Dynamic Page</h1>
    <div id="random-data">
      {{ data }}
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch('/api/random', { key: `swr-dynamic-${route.params.id}` })
</script>
