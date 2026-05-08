<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  aProp: number
}>()
</script>
