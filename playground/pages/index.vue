<script setup lang="ts">
const colors = ['red', 'blue', 'green']
const color = ref('blue')
if (import.meta.client) {
  setInterval(() => {
    color.value = colors[Math.floor(Math.random() * colors.length)]
    console.log('updating color', color.value)
  }, 200)
}
</script>

<template>
  <div>
    Nuxt Playground before long component
    <TestMe />
    after long component
  </div>
</template>

<style scoped>
div {
  background-color: v-bind(color);
}
</style>
