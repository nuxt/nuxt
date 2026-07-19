<template>
  <div data-testid="never-rendered">
    unreachable
  </div>
</template>

<script setup lang="ts">
// Resolves after the shell has flushed, then fails — exercises the mid-stream
// error path where the HTTP status is already committed.
await new Promise(resolve => setTimeout(resolve, import.meta.server ? 150 : 0))
if (import.meta.server) {
  throw createError({ statusCode: 500, statusMessage: 'Mid-stream render failure', fatal: true })
}
</script>
