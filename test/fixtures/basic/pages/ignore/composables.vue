<script setup lang="ts">
const wasImportIgnored = typeof useIgnoredImport === 'undefined'
</script>

<template>
  <div>
    was import ignored: {{ wasImportIgnored }}
  </div>
</template>
