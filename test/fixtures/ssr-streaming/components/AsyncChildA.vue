<template>
  <div
    class="block"
    data-testid="child-a"
  >
    {{ data }}
  </div>
</template>

<script setup lang="ts">
const { data } = await useAsyncData('multi-async-a', async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  return 'child-a-loaded'
})

useHead({ meta: [{ name: 'child-a', content: 'a-meta' }] })
</script>
