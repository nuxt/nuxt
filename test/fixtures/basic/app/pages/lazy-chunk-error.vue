<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Simulates what the browser throws when a dynamically imported module cannot be fetched
// after a redeploy (chunk file no longer exists).
const LazyBroken = defineAsyncComponent(() => Promise.reject(
  new TypeError(
    'Failed to fetch dynamically imported module: ' + (import.meta.client ? window.location.origin : '') + '/_nuxt/missing-chunk-after-redeploy.js',
  ),
))
</script>

<template>
  <div>
    <p>Lazy chunk error page</p>
    <ClientOnly>
      <LazyBroken />
    </ClientOnly>
  </div>
</template>
