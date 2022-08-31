<script setup lang="ts">
const props = defineProps<{
  count: number,
}>()
// eslint-disable-next-line prefer-const
let multiplier = $ref(2)
const doubled = $computed(() => props.count * multiplier)
</script>

<template>
  <div>
    Sugar Counter {{ count }} x {{ multiplier }} = {{ doubled }}
  </div>
</template>
