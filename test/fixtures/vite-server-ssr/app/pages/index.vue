<script setup lang="ts">
const config = useRuntimeConfig()
const { data } = await useAsyncData('greeting', () => Promise.resolve({ rendered: 'from useAsyncData' }))

useHead({
  meta: [{ name: 'description', content: 'rendered on the server' }],
})
</script>

<template>
  <div>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
    <p id="async-data">
      {{ data?.rendered }}
    </p>
    <NuxtLink
      id="about-link"
      to="/about"
    >
      about
    </NuxtLink>
  </div>
</template>
