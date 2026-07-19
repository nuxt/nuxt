<template>
  <div>
    <h1>HMR with JSX</h1>
    <div data-testid="jsx-content">
      {{ text }}
    </div>
    <NuxtLink to="/">
      index
    </NuxtLink>
  </div>
</template>

<script setup lang="jsx">
const text = 'jsx: original'
</script>
