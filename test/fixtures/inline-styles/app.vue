<template>
  <div class="dedupe-app">
    <SomeComponent v-if="visible" />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const visible = ref(false)
</script>

<style scoped>
.dedupe-app {
  --inline-app-token: app;
}
</style>
