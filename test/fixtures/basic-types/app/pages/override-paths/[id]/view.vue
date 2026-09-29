<script setup lang="ts">
definePageMeta({
  name: 'overridden-view',
  // Make this the index (relative syntax)
  path: '',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-view'>
true satisfies IsEqual<typeof route.params, { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-view'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string }>) }}
    </template>
  </div>
</template>
