<script setup lang="ts">
const route = useRoute()

const PrefetchProbe = defineAsyncComponent(() => import('./components/PrefetchProbe.vue'))
</script>

<template>
  <div>
    <div class="stream-progress" />
    <PrefetchProbe v-if="route.path === '/'" />
    <NuxtPage />
  </div>
</template>
