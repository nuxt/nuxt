<script setup lang="ts">
const count = ref(0)

if (import.meta.client) {
  Promise.resolve().then(() => count.value++)
}
</script>

<template>
  <div>
    <RerenderCount :count="count" />
    <LazyRerenderSibling />
  </div>
</template>
