<template>
  <div>
    <LazyDelayedModel
      v-model="model"
      hydrate:event
      @hydrated="log"
    />
  </div>
</template>

<script setup lang="ts">
const model = ref(0)
function log () {
  console.log('Component hydrated')
}
</script>
