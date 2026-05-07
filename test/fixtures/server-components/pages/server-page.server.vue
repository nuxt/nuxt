<template>
  <div id="server-page">
    Hello this is a server page
    <NuxtLink
      to="/"
    >
      to home
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Server Page',
  meta: [
    {
      name: 'author',
      content: 'Nuxt',
    },
  ],
})
</script>
