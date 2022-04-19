<template>
  <div>
    Loading width... (server fallback)
    <slot />
  </div>
</template>

<script setup>
console.log('Hi from Server Component!')
</script>
