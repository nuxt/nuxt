<template>
  <div>
    Custom2 Layout:
    <slot />

    <div class="count">
      {{ count }}
    </div>
    <button class="add-count" @click="count++">
      add count
    </button>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)

function logFoo () {
  console.log('bar')
}

defineExpose({
  logFoo
})
</script>
