<template>
  <p>{{ someProp }}</p>
  <slot />
</template>

<script lang="ts" setup>
defineProps<{
  someProp: string;
}>()
</script>
