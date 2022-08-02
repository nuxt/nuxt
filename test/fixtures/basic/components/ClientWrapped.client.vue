<script setup lang="ts">
function exposedFunc () {
  console.log('ok')
}

defineExpose({ exposedFunc })

await new Promise(resolve => setTimeout(resolve, 300))

onMounted(() => { console.log('mounted') })
</script>

<template>
  <div>
    client-only component
  </div>
</template>
