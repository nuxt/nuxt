<template>
  <div>
    <LazyEventDelayedModel
      v-model="model"
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
