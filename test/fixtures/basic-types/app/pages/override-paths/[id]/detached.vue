<script setup lang="ts">
definePageMeta({
  name: 'overridden-detached',
  // Shares nothing with the parent path. The page stays nested in the parent component
  // at runtime, only the URL is detached.
  path: '/detached',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-detached'>
// Known inaccuracy: ancestor params are still claimed even though `/detached` has none.
true satisfies IsEqual<typeof route.params, { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-detached'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string }>) }}
    </template>
  </div>
</template>
