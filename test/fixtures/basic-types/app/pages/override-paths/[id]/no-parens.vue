<script setup lang="ts">
definePageMeta({
  name: 'overridden-no-parens',
  // `:id` without the `()` unrouting emits must still resolve to a single param.
  path: '/overridden/:id/no-parens',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'overridden-no-parens'>
true satisfies IsEqual<typeof route.params, { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'overridden-no-parens'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string }>) }}
    </template>
  </div>
</template>
