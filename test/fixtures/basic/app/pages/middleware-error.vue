<script setup lang="ts">
// #19954: a fatal error thrown in route middleware should still update the URL
// to this route on client navigation (matching SSR), so the back button works.
definePageMeta({
  middleware: [() => {
    throw createError({ statusCode: 404, statusMessage: 'Middleware error', fatal: true })
  }],
})
</script>

<template>
  <div>middleware-error page (should not render)</div>
</template>
