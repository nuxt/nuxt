<script setup lang="ts">
definePageMeta({
  name: 'named-parent-index',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'named-parent-index'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'named-parent-index'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>
  </div>
</template>
