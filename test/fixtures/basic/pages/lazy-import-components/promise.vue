<script setup lang="ts">
const pr = new Promise((resolve) => { setTimeout(resolve, 500) })
const prImmediate = Promise.resolve(42)
</script>

<template>
  <div>
    <LazyDelayedPromise
      :hydrate:promise="pr"
    />
    <LazyDelayedPromise
      :hydrate:promise="prImmediate"
    />
  </div>
</template>
