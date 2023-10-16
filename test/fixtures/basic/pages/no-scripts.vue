<template>
  <div>
    {{ count }}
    <button @click="count++">
      ++
    </button>
  </div>
</template>

<script setup lang="ts">
const count = ref(0)
</script>
