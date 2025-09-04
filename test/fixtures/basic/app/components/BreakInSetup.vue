<script setup>
// break server-side
const data = window.useNuxtApp().payload
</script>

<template>
  <div>
    This breaks in server-side setup. {{ data.serverRendered }}
  </div>
</template>
