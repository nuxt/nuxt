<script setup lang="ts">
if (useRequestURL().pathname === '/missing') {
  throw createError({ status: 404, statusText: 'Page Not Found' })
}
</script>

<template>
  <div>nitro-legacy fixture</div>
</template>
