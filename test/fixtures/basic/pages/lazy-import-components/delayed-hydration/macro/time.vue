<template>
  <div>
    <LazyTimeDelayedComponentMacro
      data-testid="hydrate-after"
      :hydrate-after="50"
    />
  </div>
</template>

<script setup lang="ts">
const LazyTimeDelayedComponentMacro = defineLazyTimeComponent(() => import('~/components/DelayedComponent.vue'))
</script>
