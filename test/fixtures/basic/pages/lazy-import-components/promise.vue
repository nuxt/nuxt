<script setup lang="ts">
const pr = new Promise(resolve => onNuxtReady(() => setTimeout(resolve, 50)))
const prImmediate = Promise.resolve(42)
</script>

<template>
  <div>
    <LazyPromiseDelayedPromise :hydrate="pr" />
    <LazyPromiseDelayedPromise :hydrate="prImmediate" />
  </div>
</template>
