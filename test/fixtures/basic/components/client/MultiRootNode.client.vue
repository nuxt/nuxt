<template>
  <div
    v-bind="$attrs"
    class="multi-root-node-count"
  >
    {{ count }}
  </div>
  <button
    class="multi-root-node-button"
    @click="add"
  >
    add 1 to count
  </button>
</template>

<script setup>
const count = ref(0)

const add = () => count.value++
</script>
