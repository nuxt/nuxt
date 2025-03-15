<script setup lang="ts">
useRoute().name satisfies 'param-id'
// @ts-expect-error wrong route name
useRoute().name satisfies 'not-param-id'
</script>

<template>
  <div>
    <NuxtPage />

    {{ $route.name satisfies 'param-id' }}
    <!-- @vue-expect-error wrong route name -->
    {{ $route.name satisfies 'not-param-id' }}
  </div>
</template>
