<script setup lang="ts">
definePageMeta({
  name: 'home-optional',
  path: '/home/:someRouteParam?',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'home-optional'>
const _valid = route.params.someRouteParam
// @ts-expect-error this param does not exist
const _invalid = route.params.notAParam
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'home-optional'>) }}
      {{ $route.params.someRouteParam }}
    </template>
  </div>
</template>
