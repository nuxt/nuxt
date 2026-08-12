<script setup lang="ts">
// #35373: `@` in a transitively-extended layer must resolve to this layer.
import NestedWidget from '@/components/NestedWidget.vue'
</script>

<template>
  <NestedWidget :count="1" />
</template>
