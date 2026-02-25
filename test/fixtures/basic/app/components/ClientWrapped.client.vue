<script setup lang="ts">
function exposedFunc () {
  console.log('ok')
}

defineExpose({ exposedFunc })
const $hello = ref('hello')
await new Promise(resolve => setTimeout(resolve, 300))

onMounted(() => {
  console.log('mounted', $hello.value)
})
</script>

<template>
  <div>
    client-only component
  </div>
</template>
