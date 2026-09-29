<script setup lang="ts">
const { data } = await useFetch('/api/me', {
  key: 'isr-appmw-me',
  headers: useRequestHeaders(['cookie', 'authorization']),
})
</script>

<template>
  <div>
    <h1>isr-appmw</h1>
    <div data-testid="marker">
      {{ data?.marker }}
    </div>
    <div data-testid="secret">
      {{ data?.secret }}
    </div>
  </div>
</template>
