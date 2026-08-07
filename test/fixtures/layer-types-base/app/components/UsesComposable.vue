<script setup lang="ts">
// #35373: `@/` subpath import from an extended layer, with type flow.
import { useLayerMessage } from '@/composables/useLayerMessage'

const { message } = useLayerMessage()
const upper: string = message.toUpperCase()
</script>

<template>
  <div>{{ upper }}</div>
</template>
