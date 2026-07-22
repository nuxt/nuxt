<template>
  <div id="payload-query">
    {{ data?.page }}
  </div>
  <NuxtLink
    data-testid="payload-query-next"
    :to="{ query: { page: page + 1 } }"
    no-prefetch
  >
    Next page
  </NuxtLink>
  <NuxtLink
    data-testid="payload-query-hash"
    :to="{ query: { page }, hash: '#section' }"
    no-prefetch
  >
    Section
  </NuxtLink>
  <div id="section" />
</template>

<script setup lang="ts">
const route = useRoute()
const page = computed(() => Number(route.query.page || 1))

const { data } = await useAsyncData(
  () => `payload-query-${page.value}`,
  () => Promise.resolve({ page: page.value }),
)
</script>
