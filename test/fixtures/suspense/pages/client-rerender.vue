<script setup lang="ts">
const count = ref(0)

// changes the client-only component's props while hydration is still pending
if (import.meta.client) {
  Promise.resolve().then(() => count.value++)
}
</script>

<template>
  <div>
    <RerenderCount :count="count" />
    <!-- an async component keeps the page's suspense, and so the client-only component's mount, pending -->
    <LazyRerenderSibling />
  </div>
</template>
