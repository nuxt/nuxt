<template>
  <div data-testid="fouc-parent">
    nested parent ready
    <!-- `FoucAsyncBlock` is only instantiated once this parent's async setup
         resolves — i.e. after the first stream chunk. Its module (and SFC
         `<style>`) is therefore registered too late for the post-shell styles
         chunk and is emitted in the closing HTML instead. -->
    <FoucAsyncBlock
      name="flashy"
      :delay="40"
    />
  </div>
</template>

<script setup lang="ts">
const { delay } = defineProps<{ delay: number }>()

await new Promise(resolve => setTimeout(resolve, import.meta.server ? delay : 0))
</script>
