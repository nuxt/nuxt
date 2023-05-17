<template>
  <div>
    <Head>
      <Title>Native Async Context</Title>
    </Head>
    {{ data }}
  </div>
</template>

<script setup lang="ts">
const nuxtApp = useNuxtApp()
const data = await nuxtApp.runWithContext(() => nestedAsyncComposable())
</script>
