<script setup lang="ts">
useHead({
  link: [
    { rel: 'preload', as: 'image', href: '/preload-target.png' },
  ],
})
</script>

<template>
  <div>
    Testing prefetching server components:

    <AsyncServerComponent :count="34" />
  </div>
</template>
