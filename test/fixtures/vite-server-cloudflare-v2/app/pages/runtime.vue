<script setup lang="ts">
// the worker is built in the `ssr` environment, which replaces a bare `navigator` with `undefined`
const runtime = import.meta.server ? globalThis.navigator.userAgent : ''
</script>

<template>
  <p id="runtime">
    {{ runtime }}
  </p>
</template>
