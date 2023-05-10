<script setup>
const url = getRequestURL()
</script>

<template>
  <div>
    <div>path: {{ url.pathname }}</div>
  </div>
</template>
