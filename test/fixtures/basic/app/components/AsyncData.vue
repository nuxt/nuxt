<template>
  <span :data-testId="props.id">
    {{ data }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  id: string
}>()
const { data } = await useAsyncData('async-data-component', async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  return `Hello from async data!`
})
</script>
