<script setup lang="ts">
defineProps<{
  count: number
}>()
</script>

<template lang="pug">
div
  span.pug-item(v-for="n in count" :key="n")
</template>
