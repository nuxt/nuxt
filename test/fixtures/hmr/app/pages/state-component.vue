<template>
  <button
    data-testid="button"
    @click="count++"
  >
    {{ count }}
  </button>
  <!--  #hmr-template -->
</template>

<script setup>
const count = ref(0)

// #hmr-script
</script>
