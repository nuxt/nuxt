<script setup lang="ts">
const route = useRoute()

useHead({
  link: [
    { rel: 'preload', as: 'image', href: `/hint-a.svg?route=${route.params.id}` },
    { rel: 'preload', as: 'image', href: `/hint-b.svg?route=${route.params.id}` },
  ],
})
</script>

<template>
  <div>Page with route-specific resource hints</div>
</template>
