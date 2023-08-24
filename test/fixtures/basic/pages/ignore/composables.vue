<script setup lang="ts">
const d = typeof useIgnoredImport
</script>

<template>
  <div>
    was import ignored: {{ d === 'undefined' }}
  </div>
</template>
