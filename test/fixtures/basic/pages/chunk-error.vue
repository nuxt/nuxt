<script setup lang="ts">
definePageMeta({
  async middleware (to, from) {
    await new Promise(resolve => setTimeout(resolve, 1))
    const nuxtApp = useNuxtApp()
    if (import.meta.client && from !== to && !nuxtApp.isHydrating) {
      // trigger a loading error when navigated to via client-side navigation
      await import(/* webpackIgnore: true */ /* @vite-ignore */ `some-non-exis${''}ting-module`)
    }
  }
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
