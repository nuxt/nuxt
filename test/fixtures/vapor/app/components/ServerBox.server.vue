<script setup lang="ts">
const rendered = 'server box'
</script>

<template>
  <div data-testid="server-box">
    <p data-testid="server-box-text">
      {{ rendered }}
    </p>
    <slot />
  </div>
</template>
