<template>
  <div>
    Single
    <div>
      data1: {{ result1.data.value }}
      data2: {{ result2.data.value }}
    </div>
  </div>
</template>

<script setup lang="ts">
const [result1, result2] = await Promise.all([useSleep(), useSleep()])

if (result1.data.value === null || result1.data.value === undefined || result1.data.value.length <= 0) {
  throw new Error('Data should never be null or empty.')
}

if (result2.data.value === null || result2.data.value === undefined || result2.data.value.length <= 0) {
  throw new Error('Data should never be null or empty.')
}

if (result1.data.value !== result2.data.value) {
  throw new Error('AsyncData not synchronised')
}

await result1.refresh()

if (result1.data.value !== result2.data.value) {
  throw new Error('AsyncData not synchronised')
}
</script>
