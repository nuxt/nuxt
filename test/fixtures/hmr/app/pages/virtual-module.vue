<script setup lang="ts">
// https://github.com/nuxt/nuxt/issues/30169
// @ts-expect-error virtual module declared by ../vite/virtual-counter-plugin.ts
import { counter } from 'virtual:hmr-counter'
</script>

<template>
  <div>
    <h1>Virtual module HMR</h1>
    <span data-testid="counter">{{ counter }}</span>
    <!-- HMR_TRIGGER -->
  </div>
</template>
