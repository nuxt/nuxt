<script setup lang="ts">
import { onServerPrefetch } from 'vue'

onServerPrefetch(async () => {})
</script>

<template>
  <div>
    <slot />
  </div>
</template>
