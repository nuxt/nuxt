<script setup lang="ts">
await useAsyncData('cross-a', async () => {
  await new Promise(resolve => setTimeout(resolve, 5000))
  return 'a'
})
</script>

<template>
  <div data-testid="cross-a">
    Page A

    <NuxtLink
      to="/cross/b"
      data-testid="link-cross-b"
    >
      Go B
    </NuxtLink>

    <NuxtLink
      to="/cross/c"
      data-testid="link-cross-c"
    >
      Go C
    </NuxtLink>
  </div>
</template>
