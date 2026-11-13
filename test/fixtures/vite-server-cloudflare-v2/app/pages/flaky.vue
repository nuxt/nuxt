<script setup lang="ts">
if ((useRequestEvent() as { req?: Request } | undefined)?.req?.headers.get('x-boom') !== 'fixed') {
  throw new Error('boom from a page the worker renders until it is fixed')
}
</script>

<template>
  <div />
</template>
