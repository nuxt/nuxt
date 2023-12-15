<script setup>
const state = useState('once', () => 0)

once(() =>  state.value++)
</script>

<template>
  <div>
    <div>once.vue</div>
    <div>once: {{ state.value }}</div>
  </div>
</template>
