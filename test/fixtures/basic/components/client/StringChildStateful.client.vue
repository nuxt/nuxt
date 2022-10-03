<script setup lang="ts">
const state = ref(0)

const add = () => state.value++

defineExpose({
  state,
  add
})
</script>

<template>
  <div>Hi i should be rendered {{ state }}</div>
</template>
