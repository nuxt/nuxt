<template>
  <div>
    <LazyEventDelayedModel v-model="model" />
  </div>
</template>

<script setup lang="ts">
const model = ref(0)
</script>
