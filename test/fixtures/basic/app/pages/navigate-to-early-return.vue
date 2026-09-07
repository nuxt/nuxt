<template>
  <div>{{ hidden.join(' ') }}</div>
</template>

<script setup>
await navigateTo('/', { redirectCode: 301 })
await navigateTo('/navigate-some-path')
const hidden = ['you', 'should', 'not', 'see', 'me']
</script>
