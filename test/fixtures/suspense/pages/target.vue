<template>
  <div>
    <div id="content">
      Hello {{ Object.keys($route.query).join(' ') }}
    </div>
  </div>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, 200))
</script>
