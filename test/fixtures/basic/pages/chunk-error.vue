<script setup lang="ts">
definePageMeta({
  middleware: defineNuxtRouteMiddleware(async (to, from) => {
    const nuxtApp = useNuxtApp()
    if (process.client && from !== to && !nuxtApp.isHydrating) {
      // trigger a loading error when navigated to via client-side navigation
      await import(/* webpackIgnore: true */ /* @vite-ignore */ `some-non-exis${''}ting-module`)
    }
  })
})
</script>

<template>
  <div>
    Chunk error page
  </div>
</template>
