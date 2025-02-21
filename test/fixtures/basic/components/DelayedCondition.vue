<template>
  <div data-testid="delayed-component">
    This {{ mounted ? "shouldn't" : 'should' }} be visible at first with conditions!
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
