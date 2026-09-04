<script setup lang="ts">
useHead({
  link: [
    { rel: 'preload', as: 'image', href: '/public.svg' },
    { rel: 'preload', as: 'fetch', href: '/ignore/public-asset' },
  ],
})
</script>

<template>
  <div>
    Testing prefetching server components:

    <AsyncServerComponent :count="34" />
  </div>
</template>
