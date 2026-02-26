<!-- eslint-disable vue/multi-word-component-names -->

<script setup lang="ts">
definePageMeta({
  value: 'added in pages:extend',
})

if (import.meta.server) {
  useRequestEvent()!.res.headers.set('x-extend', useRoute().meta.value as string)
}
</script>

<template>
  <div>
    added in pages:extend
  </div>
</template>
