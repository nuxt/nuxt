<template>
  <div>
    Custom Layout:
    <slot />

    <div class="count">
      {{ count }}
    </div>
    <button
      class="add-count"
      @click="count++"
    >
      add count
    </button>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)

function logHello () {
  console.log('world')
}

defineExpose({
  logHello
})
</script>
