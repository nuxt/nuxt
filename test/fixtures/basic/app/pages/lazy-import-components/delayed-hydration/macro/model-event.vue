<template>
  <div>
    <LazyInteractionDelayedComponentMacro
      v-model="model"
      @hydrated="log"
    />
  </div>
</template>

<script setup lang="ts">
const LazyInteractionDelayedComponentMacro = defineLazyHydrationComponent('interaction', () => import('~/components/DelayedModel.vue'))

const model = ref(0)
function log () {
  console.log('Component hydrated')
}
</script>
