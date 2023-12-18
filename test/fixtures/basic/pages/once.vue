<script setup>
const counter = useState('once', () => 0)

await once(() => counter.value++)
await once('same-key', () => counter.value++)
await once('same-key', () => counter.value++)
</script>

<template>
  <div>
    <div>once.vue</div>
    <div>once: {{ counter }}</div>
  </div>
</template>
