<script setup lang="ts">
definePageMeta({
  name: 'static-parent-child-optional',
  path: '/static-parent/:someRouteParam?/child',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'static-parent-child-optional'>
true satisfies IsEqual<typeof route.params, { someRouteParam?: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'static-parent-child-optional'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { someRouteParam?: string }>) }}
    </template>
  </div>
</template>
