<template>
  <div>
    server-only component
  </div>
</template>

<script setup>
import { appendResponseHeader } from 'h3'

appendResponseHeader(useRequestEvent(), 'x-server', 'Hello from ServerOnlyComponent.server.vue')
</script>

<style>
:root {
  --server-only: 'server-only';
}
</style>
