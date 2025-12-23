<template>
  <div>
    Single
    <div>
      data1: {{ data1 }}
      data2: {{ data2 }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: data1 } = await useSleep()
const { data: data2 } = await useSleep()

if (data1.value === null || data1.value === undefined || data1.value.length <= 0) {
  throw new Error('Data should never be null or empty.')
}

if (data2.value === null || data2.value === undefined || data2.value.length <= 0) {
  throw new Error('Data should never be null or empty.')
}

if (data1.value !== data2.value) {
  throw new Error('AsyncData not synchronised')
}
</script>
