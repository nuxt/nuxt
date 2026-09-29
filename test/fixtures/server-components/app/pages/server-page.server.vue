<template>
  <div id="server-page">
    Hello this is a server page
    <NuxtLink
      id="island-link-home"
      to="/"
    >
      to home
    </NuxtLink>
    <NuxtLink
      id="island-link-server-page"
      to="/server-page-with-nuxtpage"
    >
      to other server page
    </NuxtLink>
    <NuxtLink
      id="island-link-replace"
      to="/server-page-with-nuxtpage"
      replace
    >
      replace with other server page
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
