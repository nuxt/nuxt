<script setup lang="ts">
// @ts-expect-error passing initial value directly
const count = useState('counter', 0)

function increment () {
  count.value++
}

function decrement () {
  count.value--
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Counter</h1>
    <p>{{ count }}</p>
    <div>
      <button @click="decrement">
        -
      </button>
      <button @click="increment">
        +
      </button>
    </div>
  </div>
</template>
