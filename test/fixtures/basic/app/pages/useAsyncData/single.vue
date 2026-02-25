<template>
  <div>
    Single
    <div>
      {{ data }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { data } = await useSleep()

if (data.value === null || data.value === undefined || data.value.length <= 0) {
  throw new Error('Data should never be null or empty.')
}
</script>
