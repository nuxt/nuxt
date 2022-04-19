<script setup lang="ts">
const width = window.innerWidth
</script>

<template>
  <div>
    Window width: {{ width }}
    <slot />
  </div>
</template>
