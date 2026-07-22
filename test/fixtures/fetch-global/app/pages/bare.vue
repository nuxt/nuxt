<script setup lang="ts">
const result = ref('')

onMounted(async () => {
  result.value = await $fetch<string>('/api/hello')
})
</script>

<template>
  <div id="bare">
    {{ result }}
  </div>
</template>
