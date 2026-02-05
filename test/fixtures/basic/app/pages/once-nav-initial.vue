<script setup>
const counter = useState('once', () => 0)

await callOnce(() => counter.value++, { mode: 'navigation' })
await callOnce('same-key', () => counter.value++, { mode: 'navigation' })
await callOnce('same-key', () => counter.value++, { mode: 'navigation' })
</script>

<template>
  <div>
    <div>once.vue</div>
    <div>once: {{ counter }}</div>
  </div>
</template>
