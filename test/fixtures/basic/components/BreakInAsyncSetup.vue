<script setup>
async function getData () { }
await getData()

// break server-side
const data = window.__NUXT__
</script>

<template>
  <div>
    This breaks in server-side async setup. {{ data.serverRendered }}
  </div>
</template>
