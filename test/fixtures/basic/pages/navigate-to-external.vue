<template>
  <div>You should not see me</div>
</template>

<script setup>
if (useRoute().path === '/navigate-to-external') {
  useNuxtApp().hook('app:rendered', () => {
    throw new Error('this should not run')
  })
}
await navigateTo('https://example.com/', { external: true, replace: true })
</script>
