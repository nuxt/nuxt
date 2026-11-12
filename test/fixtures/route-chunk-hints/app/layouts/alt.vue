<script lang="ts">
// runs when the chunk is evaluated, which a prefetch must not do
performance.mark('evaluated:layout')

export default {}
</script>

<template>
  <main id="alt-layout">
    <slot />
  </main>
</template>

<style>
body {
  caret-color: rgb(1, 2, 3);
}
</style>
