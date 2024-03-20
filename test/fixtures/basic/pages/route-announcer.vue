<script setup>
useHead({
  title: 'First Page'
})
definePageMeta({
  layout: 'with-route-announcer'
})
</script>

<template>
  <NuxtLink
    role="link"
    to="/route-announcer2"
  >
    Link
  </NuxtLink>
</template>
