<script setup lang="ts">
const headers = useRequestHeaders(['cookie', 'authorization'])
</script>

<template>
  <div id="header-echo">
    <span id="island-cookie">{{ headers.cookie ?? 'none' }}</span>
    <span id="island-authorization">{{ headers.authorization ?? 'none' }}</span>
  </div>
</template>
