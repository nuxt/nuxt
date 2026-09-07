<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(() => Promise.resolve(`hint ${route.params.id}`))
</script>

<template>
  <p id="hinted">
    {{ data }}
  </p>
</template>
