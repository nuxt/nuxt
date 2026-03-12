<script setup lang="ts">
useLifecycleLogs('not-keepalive-in-nuxtpage')
</script>

<template>
  <div>
    <h2>Not keepalive in `nuxt-page`</h2>
    <NuxtLink
      id="goto-keepalive"
      to="/keepalive-definepagemeta/keepalive-in-nuxtpage"
    >
      Go to keepalive
    </NuxtLink>
  </div>
</template>
