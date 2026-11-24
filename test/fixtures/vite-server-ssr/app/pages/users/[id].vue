<script setup lang="ts">
const route = useRoute()
const url = useRequestURL()
</script>

<template>
  <p id="user">
    {{ route.params.id }} at {{ url.pathname }}
  </p>
</template>
