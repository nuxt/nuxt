<script setup lang="ts">
const nuxtApp = useNuxtApp()

nuxtApp.hook('page:transition:finish', (Data) => {
  console.log('動畫完成', Data)
})
</script>

<template>
  <div>
    <NuxtPage />

    <div style="height: 150vh" />

    <NuxtLink
      :to="{
        name: 'route-scroll-behavior-scroll-to-top',
      }"
    >
      Back to scroll to top
    </NuxtLink> |
    <NuxtLink
      id="scroll-to-top"
      :to="{
        name: 'route-scroll-behavior-scroll-to-top-id',
        params: { id: 'scroll-to-top' },
        query: { scrollToTop: 'true' },
      }"
    >
      Scroll to top
    </NuxtLink> |
    <NuxtLink
      id="do-not-scroll-to-top"
      :to="{
        name: 'route-scroll-behavior-scroll-to-top-id',
        params: { id: 'do-not-scroll-to-top' },
        query: { scrollToTop: 'false' },
      }"
    >
      Do not scroll to top
    </NuxtLink>
  </div>
</template>
