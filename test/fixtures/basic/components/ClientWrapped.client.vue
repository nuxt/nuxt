<script setup lang="ts">
function exposedFunc () {
  process.client && console.log('ok')
}

defineExpose({ exposedFunc })

await new Promise(resolve => setTimeout(resolve, 300))

onMounted(() => {
  process.client && console.log('mounted')
})
</script>

<template>
  <div>
    client-only component
  </div>
</template>
