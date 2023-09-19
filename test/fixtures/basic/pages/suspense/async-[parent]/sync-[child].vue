<script setup lang="ts">
// eslint-disable-next-line no-console
process.client && console.log('[async] [sync]')
const route = useRoute('suspense-async-parent-sync-child')
</script>

<template>
  <div :id="'child' + route.path.replace(/[/-]+/g, '-')">
    Sync child: {{ route.params.parent }} - {{ route.params.child }}
  </div>
</template>
