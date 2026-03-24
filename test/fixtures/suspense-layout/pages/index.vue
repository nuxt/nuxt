<script setup lang="ts">
definePageMeta({ layout: 'alternate' })
</script>

<template>
  <div>
    <h2 data-testid="home-title">Home</h2>
    <NuxtLink to="/redirect" data-testid="btn-redirect">
      Navigate with redirect
    </NuxtLink>
  </div>
</template>
