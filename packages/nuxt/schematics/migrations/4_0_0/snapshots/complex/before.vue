<script setup lang="ts">
const pending = 'something-else'
const status = 'something-else'
const { data, pending: testididi } = await useAsyncData(async () => {
  // do something
})
</script>

<template>
  <div v-if="testididi">
    Waiting for data
  </div>
  <pre v-else>
    {{ data }}
  </pre>
</template>

<style scoped>
:root {
  font-family: 'Inter var';
}
</style>
