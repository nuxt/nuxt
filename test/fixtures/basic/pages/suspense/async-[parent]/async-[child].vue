<script setup lang="ts">
console.log('[async] [async]')
const route = useRoute('suspense-async-parent-async-child')
await new Promise(resolve => setTimeout(resolve, 500))
console.log(`[async] [${route.params.parent}] [async] [${route.params.child}] running async data`)
const data = route.params
</script>

<template>
  <div :id="'child' + route.path.replace(/[/-]+/g, '-')">
    Async child: {{ route.params.parent }} - {{ route.params.child }}
    <hr>
    {{ data }}
  </div>
</template>
