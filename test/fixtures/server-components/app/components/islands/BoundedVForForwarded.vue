<script setup lang="ts">
defineProps<{
  count: number
}>()
</script>

<template>
  <div>
    <RowList :rows="count" />
  </div>
</template>
