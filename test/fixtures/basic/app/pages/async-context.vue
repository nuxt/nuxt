<template>
  <div>
    <Head>
      <Title>Native Async Context</Title>
    </Head>
    {{ data }}
  </div>
</template>

<script setup lang="ts">
const data = await nestedAsyncComposable()
</script>
