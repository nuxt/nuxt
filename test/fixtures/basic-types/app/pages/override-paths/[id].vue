<script setup lang="ts">
definePageMeta({
  name: 'overridden',
  path: '/overridden/:id()',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden' | 'overridden-view' | 'overridden-absolute' | 'overridden-no-parens' | 'overridden-detached'>
true satisfies IsEqual<typeof route.params, { id: string } | { id: string } | { id: string } | { id: string } | { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden' | 'overridden-view' | 'overridden-absolute' | 'overridden-no-parens' | 'overridden-detached'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string } | { id: string } | { id: string } | { id: string } | { id: string }>) }}
    </template>

    <NuxtPage />
  </div>
</template>
