<script setup lang="ts">
const someValue = useState('val', () => 1)
</script>

<template>
  <div>
    <NuxtLink
      no-prefetch
      to="/chunk-error"
    >
      Chunk error
    </NuxtLink>
    Some value: {{ someValue }}
    <button @click="someValue++">
      Increment state
    </button>
  </div>
</template>

<style scoped>
div {
  color: rgb(0, 0, 0);
}
</style>
