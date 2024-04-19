<script setup lang="ts">
const pending = 'something-else'
const { data, pending: testididi } = await useAsyncData(async () => {
  // do something
  console.log('testididi')
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
