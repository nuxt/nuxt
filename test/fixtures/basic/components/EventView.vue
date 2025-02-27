<template>
  <div>
    This {{ mounted ? 'is' : 'is not' }} mounted.
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
