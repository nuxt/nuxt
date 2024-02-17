<script setup>
// needed because without it, $route's type will error out
definePageMeta()
</script>

<template>
  <div>
    <div>Greeting: {{ $route.meta.hello }}</div>
  </div>
</template>
