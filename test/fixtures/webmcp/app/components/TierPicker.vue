<script setup lang="ts">
const tier = defineModel<string>()
</script>

<template>
  <div role="listbox">
    <span
      v-for="option in ['basic', 'plus']"
      :key="option"
      role="option"
      :aria-selected="option === tier"
      @click="tier = option"
    >{{ option }}</span>
  </div>
</template>
