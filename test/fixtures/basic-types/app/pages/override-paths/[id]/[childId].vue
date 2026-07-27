<script setup lang="ts">
definePageMeta({
  name: 'overridden-detached-child-param',
  // Known inaccuracy: typed routes still claim file-derived params even though `/detached`
  // itself has none. This detached child regression check verifies we keep that insertion path.
  path: '/detached',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-detached-child-param'>
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
