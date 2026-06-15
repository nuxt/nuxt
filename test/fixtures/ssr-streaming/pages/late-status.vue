<template>
  <div data-testid="title">
    Late Status
  </div>
</template>

<script setup lang="ts">
// Mutates the response status *after* an await — i.e. after the streaming
// shell has already committed. The 418 is dropped when streaming, but the
// buffered renderer (e.g. for bots) applies it.
await new Promise(resolve => setTimeout(resolve, 50))
setResponseStatus(useRequestEvent()!, 418)
useHead({ title: 'Late Status' })
</script>
