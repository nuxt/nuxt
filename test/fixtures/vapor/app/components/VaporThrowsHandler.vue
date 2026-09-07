<script setup lang="ts" vapor>
function boom () {
  throw new Error('vapor handler error')
}
</script>

<template>
  <button
    data-testid="vapor-throws-handler"
    @click="boom"
  >
    throw in handler
  </button>
</template>
