<template>
  <div>You should not see me</div>
</template>

<script setup>
definePageMeta({
  alias: ['/setup-should-not-run'],
  middleware: to => to.path === '/navigate-to-error' ? navigateTo('/setup-should-not-run') : undefined
})
// eslint-disable-next-line no-console
process.client && console.log('running setup')
useNuxtApp().hook('app:rendered', () => {
  throw new Error('this should not run')
})
</script>
