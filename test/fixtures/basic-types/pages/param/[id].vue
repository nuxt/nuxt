<script setup lang="ts">
useRoute().name satisfies 'param-id'
// @ts-expect-error wrong route name
useRoute().name satisfies 'not-param-id'

useRoute().params.id satisfies string
// @ts-expect-error non-existent parameter
useRoute().params.nonExistant satisfies string
</script>

<template>
  <div>
    <NuxtPage />

    {{ $route.name satisfies 'param-id' }}
    <!-- @vue-expect-error wrong route name -->
    {{ $route.name satisfies 'not-param-id' }}

    {{ $route.params.id satisfies string }}
    <!-- @vue-expect-error non-existent parameter -->
    {{ $route.params.nonExistant satisfies string }}
  </div>
</template>
