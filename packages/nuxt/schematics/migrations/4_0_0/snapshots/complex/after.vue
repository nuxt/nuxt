<script setup lang="ts">
const pending = 'something-else'
const { data, status } = await useAsyncData(async () => {
  // do something
});
const testididi = computed(() => status.value === 'pending' || status.value === 'idle')
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



