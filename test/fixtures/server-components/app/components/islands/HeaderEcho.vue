<script setup lang="ts">
// Echoes the request headers the island subrequest was rendered with.
const headers = useRequestHeaders(['cookie', 'authorization'])
</script>

<template>
  <div id="header-echo">
    <span id="island-cookie">{{ headers.cookie ?? 'none' }}</span>
    <span id="island-authorization">{{ headers.authorization ?? 'none' }}</span>
  </div>
</template>
