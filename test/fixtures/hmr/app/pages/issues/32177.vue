<template>
  <pre data-testid="contents">{{ elements }}</pre>
</template>

<script setup>
// #HMR_REPLACE
const { data: elements } = await useAsyncData(() => ['Element 1', 'Element 2'].join(', '))
</script>
