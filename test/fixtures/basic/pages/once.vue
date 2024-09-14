<script setup>
const counter = useState('once', () => 0)

await callOnce(() => counter.value++)
await callOnce('same-key', () => counter.value++)
await callOnce('same-key', () => counter.value++)
</script>

<template>
  <div>
    <div>once.vue</div>
    <div>once: {{ counter }}</div>
  </div>
</template>
