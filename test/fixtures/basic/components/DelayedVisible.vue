<template>
  <div>
    This {{ mounted ? "shouldn't" : 'should' }} be visible at first with viewport!
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
