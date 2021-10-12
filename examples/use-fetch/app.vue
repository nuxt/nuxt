<template>
  <div>
    Server response: {{ data }}
  </div>
</template>

<script setup>
const { data } = await useFetch('/api/hello', { params: { foo: 'bar' } })
</script>
