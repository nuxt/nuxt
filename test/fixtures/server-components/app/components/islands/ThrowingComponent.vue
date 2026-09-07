<template>
  <div>never rendered</div>
</template>

<script setup lang="ts">
throw createError({ status: 404, statusText: 'Island not found', fatal: true })
</script>
