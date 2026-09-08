<script setup lang="ts">
defineProps<{ error: { statusCode?: number, message?: string } }>()
</script>

<template>
  <div>
    custom error page: {{ error.statusCode }} {{ error.message }}
  </div>
</template>
