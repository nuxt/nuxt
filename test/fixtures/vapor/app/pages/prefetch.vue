<script setup lang="ts" vapor>
const prefetched = useState('vapor-prefetched', () => 'not-prefetched')
onServerPrefetch(async () => {
  await new Promise(resolve => setTimeout(resolve, 10))
  prefetched.value = 'prefetched-on-server'
})

const onceCount = useState('vapor-once-count', () => 0)
await callOnce(() => {
  onceCount.value++
})
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Prefetch vapor page
    </h1>
    <p data-testid="prefetched">
      {{ prefetched }}
    </p>
    <p data-testid="once-count">
      once: {{ onceCount }}
    </p>
  </div>
</template>
