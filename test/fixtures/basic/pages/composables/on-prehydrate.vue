<script setup lang="ts">
onPrehydrate(() => {
  // This is guaranteed to run before Nuxt hydrates
  console.log(window)
})

onPrehydrate((el) => {
  console.log(el.outerHTML)
})
onPrehydrate((el) => {
  console.log(el.outerHTML)
})
onPrehydrate((el) => {
  console.log('other', el.outerHTML)
})
</script>

<template>
  <div>
    onPrehydrate testing
  </div>
</template>
