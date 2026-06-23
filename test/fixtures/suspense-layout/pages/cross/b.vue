<script setup lang="ts">
await useAsyncData('cross-b', async () => {
  await new Promise(resolve => setTimeout(resolve, 5000))
  return 'b'
})
</script>

<template>
  <div data-testid="cross-b">
    Page B

    <NuxtLink
      to="/cross/c"
      data-testid="link-cross-c"
    >
      Go C
    </NuxtLink>
  </div>
</template>