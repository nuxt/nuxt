<script setup lang="ts">
if (import.meta.client) {
  console.log('[sync] [async]')
}
const route = useRoute('suspense-async-parent-sync-child')
await new Promise(resolve => setTimeout(resolve, 500))
if (import.meta.client) {
  console.log(`[sync] [${route.params.parent}] [async] [${route.params.child}] running async data`)
}
const data = route.params
</script>

<template>
  <div :id="'child' + route.path.replace(/[/-]+/g, '-')">
    Async child: {{ route.params.parent }} - {{ route.params.child }}
    <hr>
    {{ data }}
  </div>
</template>
