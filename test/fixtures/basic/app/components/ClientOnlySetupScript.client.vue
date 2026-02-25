<script setup lang="ts">
const props = defineProps<{ foo: string }>()
</script>

<template>
  <div>
    <div>client only script setup component {{ props.foo }}</div>
    <slot name="test" />
  </div>
</template>
