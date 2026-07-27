<script setup lang="ts">
definePageMeta({
  name: 'overridden-detached-child-param',
  path: '/detached-child',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-detached-child-param'>
// Known inaccuracy: file-derived params are still claimed even though `/detached-child` has none.
true satisfies IsEqual<typeof route.params, { id: string, childId: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-detached-child-param'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string, childId: string }>) }}
    </template>
  </div>
</template>
