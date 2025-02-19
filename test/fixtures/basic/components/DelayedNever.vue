<template>
  <div>
    This {{ mounted ? "shouldn't" : 'should' }} always be visible!
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
