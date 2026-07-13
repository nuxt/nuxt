<script setup lang="ts">
definePageMeta({
  middleware: 'tracker',
})

const tracked = useState('tracked', () => false)
</script>

<template>
  <h1 id="page">
    named-page:tracked-{{ tracked }}
  </h1>
</template>
