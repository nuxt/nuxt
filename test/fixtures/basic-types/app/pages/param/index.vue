<script setup lang="ts">
definePageMeta({
  name: 'param2',
  alias: ['/param-other'],
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'param2'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'param2'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>
  </div>
</template>
