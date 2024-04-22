<script setup lang="ts">
const { data, status, error, refresh } = await useAsyncData(async () => {
  // do something
});
const pending = computed(() => status.value === 'pending' || status.value === 'idle');

</script>

<template>
  <div v-if="pending">
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
