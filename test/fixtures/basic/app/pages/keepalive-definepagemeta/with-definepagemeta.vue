<script setup lang="ts">
useLifecycleLogs('keepalive-with-definepagemeta')

definePageMeta({ keepalive: true })
</script>

<template>
  <div>
    <h2>Keepalive with `definePageMeta`</h2>
    <NuxtLink
      id="goto-no-keepalive"
      to="/keepalive-definepagemeta/without-definepagemeta"
    >
      Go to no keepalive
    </NuxtLink>
  </div>
</template>
