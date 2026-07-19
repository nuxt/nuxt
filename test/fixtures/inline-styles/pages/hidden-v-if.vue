<template>
  <div class="dedupe-app">
    <SomeComponent v-if="visible" />
    <button @click="toggle">
      Toggle Component
    </button>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const visible = ref(false)

function toggle () {
  visible.value = !visible.value
}
</script>

<style scoped>
.dedupe-app {
  --inline-app-token: app;
}
</style>
