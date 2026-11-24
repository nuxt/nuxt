<script setup lang="ts">
if (useRequestHeader('x-boom') !== 'fixed') {
  throw new Error('boom from a streamed page until it is fixed')
}
</script>

<template>
  <div>streamed without error</div>
</template>
