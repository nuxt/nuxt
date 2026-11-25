<script setup lang="ts">
const tier = defineModel<string>()
const props = defineProps<{ disabled?: boolean }>()
</script>

<template>
  <div role="listbox">
    <span
      v-for="option in ['basic', 'plus']"
      :key="option"
      role="option"
      :aria-selected="option === tier"
      @click="props.disabled || (tier = option)"
    >{{ option }}</span>
  </div>
</template>
