<script setup lang="ts">
const headers = useRequestHeaders(['if-match', 'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since', 'range'])
</script>

<template>
  <pre id="island-conditional-headers">{{ headers }}</pre>
</template>
