<script setup lang="ts">
definePageMeta({
  layout: 'override',
  middleware: 'override',
})

useRoute().name satisfies 'override'
// @ts-expect-error wrong route name
useRoute().name satisfies 'not-override'
</script>

<template>
  <div>
    <div>Extended page from bar</div>
    <div>Middleware | override: {{ $route.meta.override }}</div>
    <ExtendsOverride />

    {{ $route.name satisfies 'override' }}
    <!-- @vue-expect-error wrong route name -->
    {{ $route.name satisfies 'not-override' }}
  </div>
</template>
