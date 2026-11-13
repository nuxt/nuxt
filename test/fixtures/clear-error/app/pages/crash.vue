<script setup lang="ts">
record('crash:setup')

throw createError({ status: 500, message: 'crashed', fatal: true })
</script>

<template>
  <div>
    unreachable
  </div>
</template>
