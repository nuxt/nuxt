<script setup lang="ts" vapor>
const count = ref(0)
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Keepalive vapor
    </h1>
    <button
      data-testid="keepalive-vapor-button"
      @click="count++"
    >
      count is {{ count }}
    </button>
  </div>
</template>
