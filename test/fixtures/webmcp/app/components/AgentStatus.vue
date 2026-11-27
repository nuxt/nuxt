<script setup lang="ts">
const { current, stop } = useAgentActivity()
</script>

<template>
  <p
    v-if="current"
    data-testid="activity"
  >
    {{ current.tool }}
    <button @click="stop">
      Stop
    </button>
  </p>
</template>
