<script setup>
const url = useRequestURL()
</script>

<template>
  <div>
    <div>path: {{ url.pathname }}</div>
  </div>
</template>
