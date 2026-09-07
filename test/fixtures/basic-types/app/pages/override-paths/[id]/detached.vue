<script setup lang="ts">
definePageMeta({
  name: 'overridden-detached',
  // Shares nothing with the parent path. The page stays nested in the parent component
  // at runtime, only the URL is detached.
  path: '/detached',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-detached'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-detached'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>
  </div>
</template>
