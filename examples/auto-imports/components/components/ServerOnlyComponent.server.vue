<script setup lang="ts">
const props = defineProps({ foo: Number })
const colors = [
  'red',
  'blue',
  'yellow'
]
const color = colors[(props.foo ?? 1) % colors.length]
</script>

<template>
  <section class="flex flex-col gap-1 p-4">
    I'm a server component with some reactive state: {{ foo }}
  </section>
</template>

<style scoped>
.flex {
  color: v-bind(color)
}
</style>
