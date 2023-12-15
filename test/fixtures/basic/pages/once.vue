<script setup>
const counter = useState('once', () => 0)

once(() => counter.value++)
</script>

<template>
  <div>
    <div>once.vue</div>
    <div>once: {{ counter }}</div>
  </div>
</template>
