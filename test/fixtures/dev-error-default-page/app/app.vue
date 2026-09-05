<script setup lang="ts">
import { useBoom } from './utils/boom'

if (useRoute().path === '/') {
  useBoom()
}
</script>

<template>
  <div>rendered without error</div>
</template>
