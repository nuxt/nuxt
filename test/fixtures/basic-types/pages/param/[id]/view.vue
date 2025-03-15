<script setup lang="ts">
definePageMeta({
  name: 'param-id-view-custom',
  // Deliberately passing absolute path here to test if params are not being duplicated in RouteNamedMap
  path: '/param/:id()/view-custom',
})

useRoute().name satisfies 'param-id-view-custom'
// @ts-expect-error wrong route name
useRoute().name satisfies 'not-param-id-view-custom'
</script>

<template>
  <div>
    {{ $route.name satisfies 'param-id-view-custom' }}
    <!-- @vue-expect-error wrong route name -->
    {{ $route.name satisfies 'not-param-id-view-custom' }}
  </div>
</template>
