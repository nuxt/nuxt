<script setup lang="ts">
definePageMeta({
  layout: 'legacy',
})
</script>

<template>
  <div class="legacy-page">
    legacy page
    <NuxtLink
      to="/"
      no-prefetch
    >
      go back
    </NuxtLink>
  </div>
</template>
