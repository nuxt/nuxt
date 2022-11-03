<script setup lang="ts">
defineProps({
  count: {
    type: Number,
    required: true
  }
})
</script>

<template>
  <div>
    <SugarCounter :count="count" />
  </div>
</template>
