<script setup lang="ts">
const result = ref('')

onMounted(async () => {
  const globalFetch = (window as unknown as { $fetch: (url: string) => Promise<string> }).$fetch
  result.value = await globalFetch('/api/hello')
})
</script>

<template>
  <div id="result">
    {{ result }}
  </div>
</template>
