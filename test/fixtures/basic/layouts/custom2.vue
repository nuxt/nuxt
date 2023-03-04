<template>
  <div>
    Custom2 Layout:
    <slot />

    <div id="count">
      {{ count }}
    </div>
    <button id="add-count" @click="count++">add count</button>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)

function logFoo () {
  console.log('foo')
}

defineExpose({
  logFoo
})
</script>
