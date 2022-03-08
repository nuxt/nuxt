<script setup>
definePageMeta({
  middleware: 'inject-auth'
})
</script>

<template>
  <div>
    <div>auth.vue</div>
    <div>auth: {{ $route.meta.auth }}</div>
  </div>
</template>
