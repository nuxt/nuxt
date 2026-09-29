<script setup lang="ts">
const { enabled, state } = usePreviewMode()
</script>

<template>
  <div>
    <span id="preview-enabled">{{ enabled }}</span>
    <span id="preview-token">{{ state.token }}</span>
  </div>
</template>
