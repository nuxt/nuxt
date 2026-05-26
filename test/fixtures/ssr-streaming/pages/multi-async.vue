<template>
  <div>
    <h1 data-testid="title">
      Multi Async
    </h1>
    <Suspense>
      <AsyncChildA />
    </Suspense>
    <Suspense>
      <AsyncChildB />
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Multi Async Page' })
</script>
