<template>
  <div
    class="block"
    data-testid="child-b"
  >
    {{ data }}
  </div>
</template>

<script setup lang="ts">
const { data } = await useAsyncData('multi-async-b', async () => {
  await new Promise(resolve => setTimeout(resolve, 200))
  return 'child-b-loaded'
})

useHead({ meta: [{ name: 'child-b', content: 'b-meta' }] })
</script>
