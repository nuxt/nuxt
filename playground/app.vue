<script setup lang="ts">
// FIXME: remove these changes before merging
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <NuxtLink to="/">
    Home
  </NuxtLink>
  |
  <NuxtLink to="/about">
    About
  </NuxtLink>
  |
  <RouterLink to="/_new_extend">
    Added in Nuxt Config
  </RouterLink>
  |
  <RouterLink :to="{ name: '/users/[id]', params: { id: 5 } }">
    Some User
  </RouterLink>

  <hr>

  <NuxtPage />
</template>

<style scoped>

</style>
