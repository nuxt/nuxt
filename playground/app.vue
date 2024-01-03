<script setup lang="ts">
const base64 = Buffer.from('Nuxt is Awesome!', 'utf8').toString('base64')
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>
    {{ base64 }}
  </div>
</template>

<style scoped>

</style>
