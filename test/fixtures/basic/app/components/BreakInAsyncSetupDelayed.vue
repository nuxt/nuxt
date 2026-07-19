<script setup>
async function getData () {
  await new Promise(resolve => setTimeout(resolve, 50))
}
await getData()

const data = window.useNuxtApp().payload
</script>

<template>
  <div>
    This breaks in delayed server-side async setup. {{ data.serverRendered }}
  </div>
</template>
