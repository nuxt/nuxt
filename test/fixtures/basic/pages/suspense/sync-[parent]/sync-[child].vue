<script setup lang="ts">
process.client && console.log('[sync] [sync]')
const route = useRoute('suspense-sync-parent-sync-child')
</script>

<template>
  <div :id="'child' + route.path.replace(/[/-]+/g, '-')">
    Sync child: {{ route.params.parent }} - {{ route.params.child }}
  </div>
</template>
