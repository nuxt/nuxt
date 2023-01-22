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
    <SugarCounter :multiplier="multiplier" />
  </div>
</template>
