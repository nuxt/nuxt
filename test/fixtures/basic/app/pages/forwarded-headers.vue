<script setup lang="ts">
const { data: forwarded } = await useFetch('/api/request-headers')
const { data: absolute } = await useFetch('/api/request-headers', { baseURL: useRequestURL().origin })
</script>

<template>
  <div>
    <pre id="forwarded">{{ forwarded }}</pre>
    <pre id="absolute">{{ absolute }}</pre>
  </div>
</template>
