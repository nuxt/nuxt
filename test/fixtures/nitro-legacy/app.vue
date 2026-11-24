<script setup lang="ts">
const { pathname } = useRequestURL()
if (pathname === '/missing') {
  throw createError({ status: 404, statusText: 'Page Not Found' })
}
const socket = pathname === '/socket' ? (await useFetch('/api/socket')).data : undefined
</script>

<template>
  <div>nitro-legacy fixture</div>
  <div v-if="socket">
    in-process: {{ socket.inProcess }}
  </div>
</template>
