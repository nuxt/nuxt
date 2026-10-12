<script setup lang="ts">
defineProps<{
  blockId: string
  multiplier: number
}>()
</script>

<template>
  <div
    :id="blockId"
    class="multi-server-counter"
  >
    <span class="multi-label">block:{{ blockId }} x{{ multiplier }}</span>
    <Counter
      v-load-client
      :multiplier="multiplier"
    />
  </div>
</template>
