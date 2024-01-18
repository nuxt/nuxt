<script setup>
const index = ref(0);

const next = () => (index.value += 1);
</script>

<template>
  <div>
    <button @click="next">Click</button>
    <ServerComponent :index="index" />
  </div>
</template>
