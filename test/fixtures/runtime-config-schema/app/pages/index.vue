<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div id="mode">
    {{ config.public.mode }}
  </div>
</template>
