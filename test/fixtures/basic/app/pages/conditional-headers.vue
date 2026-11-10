<script setup lang="ts">
const requestFetch = useRequestFetch()
const { data: cached } = await useFetch('/api/conditional/cached')
const { data: headers } = await useAsyncData(() => requestFetch('/api/conditional/headers'))
</script>

<template>
  <div>
    <pre id="cached">{{ cached }}</pre>
    <pre id="headers">{{ headers }}</pre>
  </div>
</template>
