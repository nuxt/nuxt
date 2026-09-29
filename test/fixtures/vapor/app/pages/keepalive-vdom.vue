<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Keepalive vdom
    </h1>
    <button
      data-testid="keepalive-vdom-button"
      @click="count++"
    >
      count is {{ count }}
    </button>
  </div>
</template>
