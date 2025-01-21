<template>
  <div>
    <span id="count">{{ model }}</span>
    <button
      id="inc"
      @click="model++"
    >
      Increment
    </button>
  </div>
</template>

<script setup lang="ts">
const model = defineModel()
</script>
