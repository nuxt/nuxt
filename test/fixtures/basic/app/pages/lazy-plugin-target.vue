<template>
  <div>
    <div data-testid="lazy-navigated">
      {{ lazyPluginNavigated }}
    </div>
  </div>
</template>

<script setup lang="ts">
const lazyPluginNavigated = useState('lazy-plugin-navigated', () => false)
</script>
