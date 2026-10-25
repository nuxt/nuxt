<script setup lang="ts">
const props = withDefaults(defineProps<{ as?: string }>(), { as: 'div' })
</script>

<template>
  <div class="as-prop-island">
    as: {{ props.as }}
  </div>
</template>
