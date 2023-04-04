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
const someValue = useState('val', () => 1)
</script>

<template>
  <div>
    Chunk error page
    <hr>
    State: {{ someValue }}
  </div>
</template>
