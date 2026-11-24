<script setup lang="ts">
useHead({
  meta: [{ name: 'island-trusted-meta', content: 'trusted' }],
})
useHeadSafe({
  meta: [{ name: 'island-safe-meta', content: 'safe' }],
  bodyAttrs: {
    class: 'island-safe-body',
    onload: 'window.__islandUnsafe = "onload"',
  },
  script: [{ textContent: 'window.__islandUnsafe = "script"' }],
})
</script>

<template>
  <div id="safe-head-island">
    safe head
  </div>
</template>
