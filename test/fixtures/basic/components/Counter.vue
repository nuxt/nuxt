<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const props = defineProps<{
  multiplier: number
}>()
const count = ref(12)
const doubled = computed(() => count.value * props.multiplier)

await new Promise(resolve => setTimeout(resolve, 1000))
</script>

<template>
  <div class="sugar-counter">
    Sugar Counter {{ count }} x {{ multiplier }} = {{ doubled }}
    <button @click="count += 1">
      Inc
    </button>

    <slot />
  </div>
</template>
