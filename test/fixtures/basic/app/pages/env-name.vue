<script setup lang="ts">
const envName = import.meta.envName
</script>

<template>
  <div data-testid="env-name">
    {{ envName }}
  </div>
</template>
