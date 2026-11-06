<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
    <NuxtLink
      id="about-link"
      to="/about"
    >
      about
    </NuxtLink>
  </div>
</template>
