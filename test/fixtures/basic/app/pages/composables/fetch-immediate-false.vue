<template>
  <div>
    <input
      v-model="query.q"
      data-testid="query"
      type="text"
    >
    <pre data-testid="status">{{ status }}</pre>
    <pre data-testid="data">{{ data }}</pre>
    <pre data-testid="error">{{ error }}</pre>
  </div>
</template>

<script setup>
const query = reactive({ q: 1 })

const { data, execute, status, error } = useFetch(
  '/api/wait/10',
  {
    query,
    immediate: false,
  },
)

watch(query, () => execute(), { once: true })
</script>
