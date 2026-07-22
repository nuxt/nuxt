<script setup lang="ts">
definePageMeta({
  name: 'overridden-absolute',
  path: '/overridden/:id()/absolute',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-absolute'>
true satisfies IsEqual<typeof route.params, { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-absolute'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string }>) }}
    </template>
  </div>
</template>
