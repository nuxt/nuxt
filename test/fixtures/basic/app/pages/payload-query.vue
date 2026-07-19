<template>
  <div id="payload-query">
    {{ data }}
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const page = computed(() => Number(route.query.page || 1))

const { data } = await useAsyncData(
  () => `payload-query-${page.value}`,
  () => Promise.resolve({ page: page.value }),
)
</script>
