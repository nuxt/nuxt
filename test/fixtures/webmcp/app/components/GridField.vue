<script setup lang="ts">
const value = defineModel<string>()
</script>

<template>
  <label class="grid-field">
    Nickname <input v-model="value">
  </label>
</template>

<style scoped>
.grid-field {
  display: contents;
}
</style>
