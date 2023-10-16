<template>
  <div>You should not see me</div>
</template>

<script setup>
if (useRoute().path === '/navigate-to-external') {
  useNuxtApp().hook('app:rendered', () => {
    throw new Error('this should not run')
  })
}
await navigateTo({ path: 'https://example.com/', query: { redirect: false }, hash: '#test' }, { external: true, replace: true })
</script>
