<script setup lang="ts">
const runtime = import.meta.server ? navigator.userAgent : ''
</script>

<template>
  <p id="runtime">
    {{ runtime }}
  </p>
</template>
