<script setup lang="ts">
definePageMeta({
  name: 'overridden-detached-child-param',
  path: '/detached-child',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-detached-child-param'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-detached-child-param'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>
  </div>
</template>
