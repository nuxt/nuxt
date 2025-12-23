<template>
  <div>
    <LazyTimeDelayedComponentMacro
      data-testid="hydrate-after"
      :hydrate-after="50"
    />
  </div>
</template>

<script setup lang="ts">
// [Vue warn]: Do not use built-in or reserved HTML elements as component id: time
defineOptions({
  name: 'LazyTimeDelayedComponentMacroPage',
})

const LazyTimeDelayedComponentMacro = defineLazyHydrationComponent('time', () => import('~/components/DelayedComponent.vue'))
</script>
