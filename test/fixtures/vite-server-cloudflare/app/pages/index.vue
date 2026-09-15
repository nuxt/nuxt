<script setup lang="ts">
const config = useRuntimeConfig()
// no server runtime, so a relative `$fetch` on the server has no origin to resolve against
const { data: hello } = await useAsyncData(() => $fetch('/api/hello'), { server: false })
</script>

<template>
  <div>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
    <p id="worker-message">
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
