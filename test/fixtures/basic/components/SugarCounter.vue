<script setup lang="ts">
// eslint-disable-next-line vue/no-setup-props-destructure
const { multiplier } = defineProps<{
  multiplier: number
}>()
const count = $ref(12)
const doubled = $computed(() => count * multiplier)
</script>

<template>
  <div class="sugar-counter">
    Sugar Counter {{ count }} x {{ multiplier }} = {{ doubled }}
    <button @click="count += 1">
      Inc
    </button>
  </div>
</template>
