<template>
  <div>
    This fake lazy event {{ mounted ? "should" : "shouldn't" }} be visible!
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
