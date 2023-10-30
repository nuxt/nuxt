<script setup lang="ts">
import { useLifecyleLogs } from './composables'

useLifecyleLogs('not-keepalive-in-nuxtpage')
</script>

<template>
  <div>
    <h2>Not Keepalive in `nuxt-page`</h2>
  </div>
</template>
