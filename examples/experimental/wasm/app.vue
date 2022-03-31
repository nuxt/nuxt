<script setup>
const a = ref(100)
const b = ref(250)

const { data } = await useAsyncData('sum',
  () => $fetch('/api/sum', { params: { a: a.value, b: b.value } })
)
</script>

<template>
  <NuxtExampleLayout example="experimental/wasm">
    <p>
      <code>a = 100</code>
    </p>
    <p>
      <code>b = 250</code>
    </p>
    <p>
      Computation performed server-side with WASM :
      <br>
      <code>{{ a }} + {{ b }} = {{ data.sum }}</code>
    </p>
  </NuxtExampleLayout>
</template>
