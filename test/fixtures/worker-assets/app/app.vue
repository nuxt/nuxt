<script setup lang="ts">
import wasmUrl from './shared.wasm?url'

const workerUrl = ref('')
onMounted(() => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => { workerUrl.value = e.data }
})
</script>

<template>
  <div>
    <p data-testid="app-asset">
      {{ wasmUrl }}
    </p>
    <p data-testid="worker-asset">
      {{ workerUrl }}
    </p>
  </div>
</template>
