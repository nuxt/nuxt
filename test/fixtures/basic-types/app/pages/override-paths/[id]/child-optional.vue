<script setup lang="ts">
definePageMeta({
  name: 'overridden-child-optional',
  path: '/overridden/:id()/:childId?/child-optional',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-child-optional'>
true satisfies IsEqual<typeof route.params, { id: string, childId?: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-child-optional'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string, childId?: string }>) }}
    </template>
  </div>
</template>
