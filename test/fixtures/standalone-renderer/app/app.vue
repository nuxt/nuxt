<script setup lang="ts">
const config = useRuntimeConfig()

useHead({
  title: 'Standalone renderer',
})

const { data } = await useAsyncData('greeting', () => Promise.resolve('rendered without nitro'))
</script>

<template>
  <div>
    <h1>{{ data }}</h1>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
  </div>
</template>
