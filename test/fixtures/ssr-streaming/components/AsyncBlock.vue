<template>
  <div class="block">
    {{ name }} (resolved after {{ delay }}ms)
  </div>
</template>

<script setup lang="ts">
const { name, delay, progress } = defineProps<{ name: string, delay: number, progress: number }>()

await new Promise(resolve => setTimeout(resolve, import.meta.server ? delay : 0))

useHead({
  style: [{ key: 'progress', innerHTML: `.stream-progress::after{width:${progress}%}` }],
})
</script>
