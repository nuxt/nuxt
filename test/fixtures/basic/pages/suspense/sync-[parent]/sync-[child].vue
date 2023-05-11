<script setup lang="ts">
console.log('[sync] [sync]')
const route = useRoute('suspense-sync-parent-sync-child')
</script>

<template>
  <div>
    Sync child: {{ route.params.parent }} - {{ route.params.child }}
  </div>
</template>
