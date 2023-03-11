<template>
  <div>You should not see me</div>
</template>

<script setup>
await navigateTo('/', { replace: true, redirectCode: 301 })
</script>
