<script setup lang="ts">
const { count } = defineProps<{
  count: number,
}>()
// eslint-disable-next-line prefer-const
let multiplier = $ref(2)
const doubled = $computed(() => count * multiplier)
</script>

<template>
  <div>
    Sugar Counter {{ count }} x {{ multiplier }} = {{ doubled }}
  </div>
</template>
