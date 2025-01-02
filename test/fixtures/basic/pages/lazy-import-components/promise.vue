<script setup lang="ts">
const pr = new Promise((resolve) => { setTimeout(resolve, 500) })
const prImmediate = Promise.resolve(42)
</script>

<template>
  <div>
    <LazyPromiseDelayedPromise
      :hydrate="pr"
    />
    <LazyPromiseDelayedPromise
      :hydrate="prImmediate"
    />
  </div>
</template>
