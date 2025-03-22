<script lang="ts" setup>
const route = useRoute()
</script>

<template>
  <div>
    <NuxtLink to="/page-load-hook">
      Back to parent
    </NuxtLink>
    <NuxtLink
      :to="{
        ...route,
        query: {
          ...route.query,
          someQuery: 'toto',
        },
      }"
    >
      Add query
    </NuxtLink>
    <NuxtLink to="/page-load-hook/other-slug">
      To other slug
    </NuxtLink>
  </div>
</template>
