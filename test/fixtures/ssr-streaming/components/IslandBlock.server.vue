<template>
  <div
    class="island-block"
    data-testid="island"
  >
    Island says: {{ message }}
  </div>
</template>

<script setup lang="ts">
const { message } = defineProps<{ message: string }>()
</script>
