<script setup lang="ts">
useLifecycleLogs('keepalive-in-nuxtpage')

definePageMeta({ keepalive: true })
</script>

<template>
  <div>
    <h2>Keepalive in `nuxt-page`</h2>
    <NuxtLink
      id="goto-no-keepalive"
      to="/keepalive-definepagemeta/not-keepalive-in-nuxtpage"
    >
      Go to no keepalive
    </NuxtLink>
  </div>
</template>
