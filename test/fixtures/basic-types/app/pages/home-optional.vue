<script setup lang="ts">
definePageMeta({
  name: 'home-optional',
  path: '/home/:someRouteParam?',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'home-optional'>
true satisfies IsEqual<typeof route.params, { someRouteParam?: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'home-optional'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { someRouteParam?: string }>) }}
    </template>
  </div>
</template>
