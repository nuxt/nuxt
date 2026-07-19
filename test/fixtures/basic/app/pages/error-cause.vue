<template>
  <div />
</template>

<script setup lang="ts">
try {
  throw new Error('inner error', { cause: new Error('root cause') })
} catch (cause) {
  throw createError({
    message: 'createError message',
    statusCode: 500,
    cause,
  })
}
</script>
