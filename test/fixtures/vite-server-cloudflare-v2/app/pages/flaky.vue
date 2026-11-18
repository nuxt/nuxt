<script setup lang="ts">
if (useRequestHeader('x-boom') !== 'fixed') {
  throw new Error('boom from a page the worker renders until it is fixed')
}
</script>

<template>
  <div />
</template>
