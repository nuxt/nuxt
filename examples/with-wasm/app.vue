
<script setup>
const a = ref(100)
const b = ref(250)

const { data } = await useAsyncData('sum',
  () => $fetch('/api/sum', { params: { a: a.value, b: b.value } })
)
</script>

<template>
  <div>
    <input v-model="a" type="number" readonly>
    +
    <input v-model="b" type="number" readonly>
    =
    <input v-model="data.sum" type="number" readonly>
  </div>
</template>
