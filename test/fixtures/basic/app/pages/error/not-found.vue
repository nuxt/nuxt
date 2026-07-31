<template>
  <div>should not render</div>
</template>

<script setup lang="ts">
throw createError({ status: 404, statusText: 'This page does not exist', fatal: true, data: { reason: 'missing' } })
</script>
