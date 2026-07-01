<template>
  <div>You should not see me</div>
</template>

<script setup lang="ts">
const cookie = useCookie('set-before-redirect')
cookie.value = 'redirected'
await navigateTo('/', { redirectCode: 302 })
</script>
