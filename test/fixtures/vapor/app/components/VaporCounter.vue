<script setup lang="ts" vapor>
const props = defineProps<{ label?: string }>()
const count = ref(0)
</script>

<template>
  <div data-testid="vapor-counter">
    <span data-testid="vapor-counter-label">{{ props.label ?? 'counter' }}</span>
    <button
      data-testid="vapor-counter-button"
      @click="count++"
    >
      count is {{ count }}
    </button>
  </div>
</template>
