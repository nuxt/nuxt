<script setup lang="ts">
const tracked = useState('tracked', () => false)
</script>

<template>
  <h1 id="page">
    rules-mw:tracked-{{ tracked }}
  </h1>
</template>
