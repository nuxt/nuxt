<script setup>
const a = ref(100)
const b = ref(250)

const { data } = await useAsyncData('sum',
  () => $fetch('/api/sum', { params: { a: a.value, b: b.value } })
)
</script>

<template>
  <NuxtExampleLayout example="with-wasm">
    {{ a }} + {{ b }} = {{ data.sum }}
  </NuxtExampleLayout>
</template>
