<script setup>
const { data: mountain } = await useFetch(
  'https://api.nuxtjs.dev/mountains/mount-everest'
)
</script>

<template>
  <pre class="text-sm text-left overflow-auto">{{ mountain }}</pre>
</template>
