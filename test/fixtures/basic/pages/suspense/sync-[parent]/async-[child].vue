<script setup lang="ts">
console.log('[sync] [async]')
const route = useRoute('suspense-async-parent-sync-child')
const { data } = await useAsyncData(async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log(`[async] [${route.params.parent}] [async] [${route.params.child}] running async data`)
  return route.params
})
</script>

<template>
  <div>
    Async child: {{ route.params.parent }} - {{ route.params.child }}
    <hr>
    {{ data }}
  </div>
</template>
