<script setup>
const nuxtApp = useNuxtApp()
await new Promise(resolve => setTimeout(resolve, 150))
const isSameApp = nuxtApp === useNuxtApp()
if (!isSameApp) {
  throw new Error('💀')
}
</script>

<template>
  <div>
    This should be true: {{ isSameApp }}
  </div>
</template>
