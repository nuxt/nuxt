<template>
  <div>Redirect target. Callback: {{ route.query.callback }}</div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
