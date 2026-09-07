<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    throw createError({ statusCode: 404, statusMessage: 'Middleware error', fatal: true })
  }],
})
</script>

<template>
  <div>middleware-error page (should not render)</div>
</template>
