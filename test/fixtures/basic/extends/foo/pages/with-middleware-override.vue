<script setup>
definePageMeta({
  middleware: 'override'
})
</script>

<template>
  <div>{{ $route.meta.override }}</div>
</template>
