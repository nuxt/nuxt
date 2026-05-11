<template>
  <div>
    <div data-testid="lazy-ran">
      {{ lazyPluginRan }}
    </div>
    <div data-testid="lazy-navigated">
      {{ lazyPluginNavigated }}
    </div>
    <div data-testid="lazy-universal-ran">
      {{ lazyUniversalRan }}
    </div>
    <NuxtLink to="/lazy-plugin-target">
      navigate
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const lazyPluginRan = useState('lazy-plugin-ran', () => false)
const lazyPluginNavigated = useState('lazy-plugin-navigated', () => false)
const lazyUniversalRan = useState('lazy-universal-ran', () => false)
</script>
