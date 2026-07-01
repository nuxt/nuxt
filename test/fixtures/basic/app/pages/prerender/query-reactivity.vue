<script setup lang="ts">
const route = useRoute()
// Capture the query as seen in `onMounted` to guard against it being restored
// too late on a prerendered page.
const mountedQuery = ref('pending')
onMounted(() => {
  mountedQuery.value = String(route.query.active)
})
</script>

<template>
  <div :style="{ color: route.query.active === 'true' ? 'red' : 'blue' }">
    Query: {{ route.query.active }}
    <span id="mounted-query">{{ mountedQuery }}</span>
  </div>
</template>
