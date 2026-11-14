<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtLoadingIndicator :throttle="0" />
  <div
    v-if="route.path === '/prerender/route-hash'"
    id="app-hash"
    :class="route.hash ? 'with-hash' : 'without-hash'"
  >
    {{ route.hash }}
  </div>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
