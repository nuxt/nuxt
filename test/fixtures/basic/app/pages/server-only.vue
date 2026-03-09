<template>
  <div>
    <h1>ServerOnly test page</h1>
    <ServerOnly>
      <span id="server-only-content">Rendered at {{ timestamp }}</span>
    </ServerOnly>
  </div>
</template>

<script setup lang="ts">
const timestamp = new Date().toISOString()
</script>
