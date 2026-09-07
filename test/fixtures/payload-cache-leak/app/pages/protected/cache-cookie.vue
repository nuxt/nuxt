<script setup lang="ts">
definePageMeta({ middleware: ['require-session'] })

const { data } = await useFetch('/api/me', {
  key: 'cache-cookie-me',
  headers: useRequestHeaders(['cookie', 'authorization']),
})
</script>

<template>
  <div>
    <h1>cache-cookie</h1>
    <div data-testid="marker">
      {{ data?.marker }}
    </div>
    <div data-testid="secret">
      {{ data?.secret }}
    </div>
  </div>
</template>
