<script setup lang="ts">
definePageMeta({
  some: 'stuff',
})
const count = ref(1)
</script>

<template>
  <div>
    <Title>HMR fixture</Title>
    <h1>Home page</h1>
    <div>
      Count:
      <span data-testid="count">{{ count }}</span>
    </div>
    <button @click="count++">
      Increment
    </button>
    <pre>{{ $route.meta }}</pre>
  </div>
</template>
