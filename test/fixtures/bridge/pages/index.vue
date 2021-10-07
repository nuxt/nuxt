<template>
  <div>Hello Vue {{ version }}!</div>
</template>

<script setup>
useMeta({ meta: [{ name: 'description', content: 'This is a page to demo Nuxt Bridge.' }] })
const version = ref('2')
</script>
