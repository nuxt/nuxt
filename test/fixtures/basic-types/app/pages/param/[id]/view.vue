<script setup lang="ts">
definePageMeta({
  name: 'param-id-view-custom',
  // Deliberately passing absolute path here to test if params are not being duplicated in RouteNamedMap
  path: '/param/:id()/view-custom',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'param-id-view-custom'>
true satisfies IsEqual<typeof route.params, { id: string }>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'param-id-view-custom'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, { id: string }>) }}
    </template>
  </div>
</template>
