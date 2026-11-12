<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

defineRouteRules({
  swr: false,
  cache: { maxAge: 5 },
})
</script>

<template>
  <div />
</template>
