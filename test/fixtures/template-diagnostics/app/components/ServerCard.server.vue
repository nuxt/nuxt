<script setup lang="ts">
const props = defineProps<{ title: string, format?: (value: string) => string }>()
</script>

<template>
  <div>{{ props.format ? props.format(props.title) : props.title }}</div>
</template>
