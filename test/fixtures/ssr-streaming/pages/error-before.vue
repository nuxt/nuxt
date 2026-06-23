<template>
  <div data-testid="never-rendered">
    unreachable
  </div>
</template>

<script setup lang="ts">
// Fails synchronously during setup, before the shell can flush — the renderer
// must fall through to the buffered error renderer with the correct status.
throw createError({ statusCode: 500, statusMessage: 'Pre-shell render failure', fatal: true })
</script>
