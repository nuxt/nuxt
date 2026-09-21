<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useBoom } from './utils/boom'

const route = useRoute()
if (route.path === '/') {
  useBoom()
}
const Broken = defineAsyncComponent(() => import('./components/Broken.vue'))
</script>

<template>
  <div>
    rendered without error
    <Broken v-if="route.path === '/compile-error'" />
  </div>
</template>
