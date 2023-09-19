<script setup lang="ts">
function exposedFunc () {
  // eslint-disable-next-line no-console
  process.client && console.log('ok')
}

defineExpose({ exposedFunc })

await new Promise(resolve => setTimeout(resolve, 300))

onMounted(() => {
  // eslint-disable-next-line no-console
  process.client && console.log('mounted')
})
</script>

<template>
  <div>
    client-only component
  </div>
</template>
