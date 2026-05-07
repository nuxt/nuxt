<template>
  <div
    v-bind="$attrs"
    data-server-only
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Server component wrapper. Slot content is rendered on the server (SSR or island fetch).
 * During hydration or client-side navigation, the slot may also run on the client.
 * @see https://github.com/nuxt/nuxt/issues/27073
 */
defineOptions({
  name: 'ServerOnly',
  inheritAttrs: false,
})
</script>
