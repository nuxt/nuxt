<script setup lang="ts">
const user = (useRequestEvent()!.context as { user?: string }).user
</script>

<template>
  <p id="context">
    {{ user ?? 'none' }}
  </p>
</template>
