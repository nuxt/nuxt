<script setup>
definePageMeta({
  middleware: 'foo'
})
</script>

<template>
  <div>{{ $route.meta.foo }}</div>
</template>
