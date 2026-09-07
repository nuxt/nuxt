<script setup lang="ts">
useHead({
  link: [
    { rel: 'preload', as: 'image', href: '/hint-a.svg' },
    { rel: 'preload', as: 'image', href: '/hint-b.svg' },
    { rel: 'preload', as: 'image', href: '/hint-c.svg' },
    { rel: 'preload', as: 'video', href: '/never-forwarded.mp4' },
  ],
})
</script>

<template>
  <div>Page with more resource hints than we are willing to forward</div>
</template>
