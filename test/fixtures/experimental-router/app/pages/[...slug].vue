<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <p>catch-all:{{ (route.params.slug as string[]).join('|') }}</p>
</template>
