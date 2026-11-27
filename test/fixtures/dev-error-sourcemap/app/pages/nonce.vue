<script setup lang="ts">
useHead({ script: [{ nonce: 'abc123', innerHTML: 'window.nonced = true' }] })
</script>

<template>
  <div>nonce page</div>
</template>
