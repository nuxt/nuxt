<script setup lang="ts">
useLifecycleLogs('keepalive-without-definepagemeta')
</script>

<template>
  <div>
    <h2>No keepalive with `definePageMeta`</h2>
    <NuxtLink
      id="goto-keepalive"
      to="/keepalive-definepagemeta/with-definepagemeta"
    >
      Go to keepalive
    </NuxtLink>
  </div>
</template>
