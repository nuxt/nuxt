<template>
  <div>
    <p>{{ someProp }}</p>
    <slot />
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  someProp: string;
}>()
</script>
