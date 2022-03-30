<script setup>
defineProps({
  color: {
    type: String,
    default: 'black'
  }
})
</script>

<template>
  <button class="ui-button" :style="{ color }">
    <slot />
  </button>
</template>
