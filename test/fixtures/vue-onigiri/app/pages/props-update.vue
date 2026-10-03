<script setup lang="ts">
const multiplier = ref(1)
</script>

<template>
  <div id="props-update-page">
    <button
      id="bump-multiplier"
      @click="multiplier += 1"
    >
      bump
    </button>
    <MultiServerCounter
      block-id="props-update-block"
      :multiplier="multiplier"
    />
  </div>
</template>
