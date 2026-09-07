<script setup lang="ts">
const headers = useRequestHeaders(['cookie', 'authorization'])
</script>

<template>
  <div>
    <span id="page-cookie">{{ headers.cookie ?? 'none' }}</span>
    <span id="page-authorization">{{ headers.authorization ?? 'none' }}</span>
    <NuxtIsland name="HeaderEcho" />
  </div>
</template>
