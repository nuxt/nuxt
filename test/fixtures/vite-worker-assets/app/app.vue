<script setup lang="ts">
import wasmUrl from './shared.wasm?url'

if (import.meta.client) {
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
}
</script>

<template>
  <div>{{ wasmUrl }}</div>
</template>
