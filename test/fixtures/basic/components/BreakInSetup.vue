<script setup>
// break server-side
const data = window.__NUXT__
</script>

<template>
  <div>
    This breaks in server-side setup. {{ data.serverRendered }}
  </div>
</template>
