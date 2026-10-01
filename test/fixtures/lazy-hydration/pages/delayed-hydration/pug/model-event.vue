<template lang="pug">
  div
    LazyDelayedModel(
      v-model="model"
      hydrate-on-interaction
      @hydrated="log"
    )
</template>

<script setup lang="ts">
const model = ref(0)
/**
 * Log once the lazily hydrated component has finished hydrating.
 */
function log () {
  console.log('Component hydrated')
}
</script>
