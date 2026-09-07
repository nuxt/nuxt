<script setup lang="ts">
const route = useRoute()
true satisfies IsEqual<typeof route.name, 'param2' | 'param-id' | 'param-id-view-custom' | 'param-id-subparam-subId'>
true satisfies IsEqual<typeof route.params, { id: string } | { id: string, subId: string } | Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'param2' | 'param-id' | 'param-id-view-custom' | 'param-id-subparam-subId'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string } | { id: string, subId: string } | Record<never, never>>) }}
    </template>
  </div>
</template>
