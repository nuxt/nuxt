<template>
  <div>
    server-only component
  </div>
</template>

<script setup>
import { appendResponseHeader } from 'h3'

appendResponseHeader(useRequestEvent(), 'x-nitro-prerender', '/some/url/from/server-only/component')
</script>

<style>
:root {
  --server-only: 'server-only';
}
</style>
