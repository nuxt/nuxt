<template>
  <div>
    Awesome Component count: {{ count }}
  </div>
</template>
<script setup lang="ts">
defineProps<{
    count?: number
}>()
</script>
