<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

defineRouteRules({
  headers: { 'x-from-page': 'index' },
})
</script>

<template>
  <div />
</template>
