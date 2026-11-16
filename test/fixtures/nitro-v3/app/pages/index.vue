<script setup lang="ts">
const { data: portable } = await useFetch('/api/portable')
const { data: legacy } = await useFetch('/api/legacy')
useCookie('from-page').value = 'yes'
</script>

<template>
  <div>
    <pre id="portable">{{ portable }}</pre>
    <pre id="legacy">{{ legacy }}</pre>
  </div>
</template>
