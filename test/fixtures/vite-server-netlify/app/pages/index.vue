<script setup lang="ts">
const config = useRuntimeConfig()
// `/api/hello` is a platform function, which a relative `$fetch` on the server does not reach
const { data: hello } = await useAsyncData(() => $fetch('/api/hello'), { server: false })
</script>

<template>
  <div>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
    <p id="function-message">
      {{ hello?.message }}
    </p>
    <NuxtLink
      id="about-link"
      to="/about"
    >
      about
    </NuxtLink>
  </div>
</template>
