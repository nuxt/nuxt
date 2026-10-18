<script setup lang="ts">
const config = useRuntimeConfig()

const path = useNuxtApp().ssrContext!.url
if (path.startsWith('/throws')) {
  throw createError({ status: 503, statusText: 'Service Unavailable', message: 'the render threw', fatal: true })
}
if (path.startsWith('/rich-data')) {
  throw createError({ status: 418, statusText: 'I am a teapot', message: 'rich data', data: { keep: 'yes', drop: () => {} }, fatal: true })
}
if (path.startsWith('/unhandled')) {
  throw new Error('an unhandled failure')
}

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
