<script setup lang="ts">
defineProps({
  multiplier: {
    type: Number,
    required: true
  }
})
</script>

<template>
  <div>
    <Counter :multiplier="multiplier" />
  </div>
</template>
