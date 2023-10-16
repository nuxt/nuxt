<script setup lang="ts">
import { setResponseHeader } from 'h3'

definePageMeta({
  value: 'added in pages:extend'
})

if (import.meta.server) {
  setResponseHeader(useRequestEvent(), 'x-extend', useRoute().meta.value as string)
}
</script>

<template>
  <div>
    added in pages:extend
  </div>
</template>
