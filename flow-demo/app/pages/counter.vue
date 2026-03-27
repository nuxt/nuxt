<script setup lang="ts">
// @ts-expect-error passing initial value directly
const count = useState('counter', 0)

function increment() {
  count.value++
}

function decrement() {
  count.value--
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Counter</h1>
    <p style="font-size: 2rem;">{{ count }}</p>
    <div style="display: flex; gap: 1rem;">
      <button @click="decrement">-</button>
      <button @click="increment">+</button>
    </div>
  </div>
</template>
