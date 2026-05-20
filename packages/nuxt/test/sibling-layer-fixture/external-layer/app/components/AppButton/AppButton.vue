<script setup lang="ts">
interface ButtonProps {
  label: string
  size?: string
}
defineProps<ButtonProps>()
</script>
<template>
  <button>{{ label }}</button>
</template>
