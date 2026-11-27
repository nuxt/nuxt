<script setup lang="ts">
const globals = useState('server-globals', () => [
  typeof window,
  typeof document,
  typeof navigator,
  typeof location,
  typeof XMLHttpRequest,
  String(window),
].join(','))

onPrehydrate(() => {
  document.documentElement.dataset.prehydrate = typeof window
})
</script>

<template>
  <div id="server-globals">
    {{ globals }}
  </div>
</template>
