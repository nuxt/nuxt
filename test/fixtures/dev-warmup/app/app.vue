<script setup lang="ts">
const greeting = await $fetch('/api/greeting')
</script>

<template>
  <div>dev warmup fixture: {{ greeting }}</div>
</template>
