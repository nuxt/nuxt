<script setup lang="ts">
const context = useRequestEvent()!.context as { user?: string, inner?: string }
const user = context.user
context.inner = 'set'
</script>

<template>
  <p id="context">
    {{ user ?? 'none' }}
  </p>
</template>
