<script setup lang="ts">
definePageMeta({
  name: 'overridden',
  path: '/overridden/:id()',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden' | 'overridden-view' | 'overridden-absolute' | 'overridden-no-parens' | 'overridden-detached' | 'overridden-child-optional' | 'overridden-detached-child-param'>
true satisfies IsEqual<typeof route.params, { id: string } | { id: string } | { id: string } | { id: string } | Record<never, never> | { id: string, childId?: string } | Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden' | 'overridden-view' | 'overridden-absolute' | 'overridden-no-parens' | 'overridden-detached' | 'overridden-child-optional' | 'overridden-detached-child-param'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string } | { id: string } | { id: string } | { id: string } | Record<never, never> | { id: string, childId?: string } | Record<never, never>>) }}
    </template>

    <NuxtPage />
  </div>
</template>
