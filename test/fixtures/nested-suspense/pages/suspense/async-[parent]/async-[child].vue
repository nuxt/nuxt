<script setup lang="ts">
if (import.meta.client) {
  console.log('[async] [async]')
}
const route = useRoute('suspense-async-parent-async-child')
await new Promise(resolve => setTimeout(resolve, 50))
if (import.meta.client) {
  console.log(`[async] [${route.params.parent}] [async] [${route.params.child}] running async data`)
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
