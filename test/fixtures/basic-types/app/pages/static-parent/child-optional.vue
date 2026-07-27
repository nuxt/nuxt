<script setup lang="ts">
definePageMeta({
  name: 'static-parent-child-optional',
  path: '/static-parent/:someRouteParam?/child',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'static-parent-child-optional'>
const _valid = route.params.someRouteParam
// @ts-expect-error this param does not exist
const _invalid = route.params.notAParam
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'static-parent-child-optional'>) }}
      {{ $route.params.someRouteParam }}
    </template>
  </div>
</template>
