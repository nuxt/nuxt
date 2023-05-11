<script setup lang="ts">
console.log('[async] [sync]')
const route = useRoute('suspense-async-parent-sync-child')
</script>

<template>
  <div>
    Sync child: {{ route.params.parent }} - {{ route.params.child }}
  </div>
</template>
